"""
Multi-Agent Supervisor System

This implements a TRUE multi-agent architecture with:
1. Supervisor Agent - Intelligently routes requests to specialized agents
2. Medicine Agent - Dedicated LLM instance for pharmacy/medicine tasks
3. Travel Agent - Dedicated LLM instance for travel planning tasks

Each agent has its own:
- LLM instance (can be different models)
- System prompt (specialized for its domain)
- Tools (domain-specific capabilities)

Architecture:
                    ┌─────────────────┐
                    │   SUPERVISOR    │
                    │     AGENT       │
                    │  (Router LLM)   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │  MEDICINE AGENT │           │  TRAVEL AGENT   │
    │   (Own LLM)     │           │   (Own LLM)     │
    │   (Own Tools)   │           │   (Own Tools)   │
    └─────────────────┘           └─────────────────┘
"""

import logging
import os
import json
import warnings
from typing import Literal, Any, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_openai import ChatOpenAI
from langchain_core.runnables import RunnableConfig

from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langgraph.store.memory import InMemoryStore
from langgraph.checkpoint.memory import MemorySaver
from pydantic import BaseModel, Field

# CopilotKit imports - use CopilotKitState as base
from copilotkit import CopilotKitState

logger = logging.getLogger(__name__)

# =============================================================================
# LONG-TERM MEMORY STORE
# =============================================================================

# Global memory store for user preferences across sessions
memory_store = InMemoryStore()

def get_user_preferences(user_id: str) -> dict:
    """Retrieve stored user preferences from memory."""
    try:
        namespace = (user_id, "preferences")
        items = list(memory_store.search(namespace))
        if items:
            return items[0].value
    except Exception as e:
        logger.warning(f"Could not retrieve user preferences: {e}")
    return {}

def save_user_preferences(user_id: str, preferences: dict) -> None:
    """Save user preferences to long-term memory."""
    try:
        namespace = (user_id, "preferences")
        memory_store.put(namespace, "user_prefs", preferences)
        logger.debug(f"Saved preferences for user {user_id}")
    except Exception as e:
        logger.warning(f"Could not save user preferences: {e}")

from src.agents.medicine import get_medicine_tools, MEDICINE_SYSTEM_PROMPT
from src.agents.travel import get_travel_tools, TRAVEL_SYSTEM_PROMPT


def get_llm(temperature: float = 0.7):
    """Get the OpenAI LLM instance."""
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=temperature,
    )


# =============================================================================
# MULTI-AGENT STATE
# =============================================================================

class AgentState(CopilotKitState):
    """
    State shared across all agents in the multi-agent system.
    
    Extends CopilotKitState which includes 'messages' field.
    """
    # Routing fields
    next_agent: str = ""                    # Which agent to route to
    task_type: str = ""                     # "medicine", "travel", or "general"
    agent_outputs: dict = {}                # Outputs from each agent
    iteration: int = 0                      # Track routing iterations


# =============================================================================
# ROUTING DECISION SCHEMA
# =============================================================================

class RouteDecision(BaseModel):
    """Schema for the supervisor's routing decision."""
    next_agent: Literal["medicine_agent", "travel_agent", "respond_directly"] = Field(
        description="Which agent should handle this request"
    )
    reasoning: str = Field(
        description="Brief explanation of why this agent was chosen"
    )
    task_summary: str = Field(
        description="One-line summary of what the user wants"
    )


# =============================================================================
# SUPERVISOR AGENT (Router)
# =============================================================================

SUPERVISOR_ROUTER_PROMPT = """You are an intelligent router that decides which specialized agent should handle a user request.

You have access to these specialized agents:

1. **medicine_agent**: Handles requests about:
   - Finding medicines at pharmacies
   - Checking medication availability
   - Pharmacy locations and hours
   - Calling pharmacies to confirm stock
   - Any pharmaceutical or medical supply needs

2. **travel_agent**: Handles requests about:
   - Planning trips and vacations
   - Creating travel itineraries
   - Finding activities and restaurants at destinations
   - Hotel and flight information
   - Any travel-related planning

3. **respond_directly**: Use ONLY for:
   - Simple greetings (hi, hello)
   - Questions about your capabilities
   - Requests that don't fit medicine or travel

Analyze the user's message and decide which agent should handle it.

IMPORTANT: 
- Consider the conversation context when routing. If the user is in a medicine-related conversation and says something like "yes" or "check that one", route to medicine_agent.
- If the request is even slightly related to medicine/pharmacy → medicine_agent
- If the request is even slightly related to travel/trips → travel_agent
- Only use respond_directly for greetings or meta questions
- Follow-up messages should go to the same agent that handled the original request"""


def create_supervisor_router():
    """Create the supervisor router that decides which agent to use."""
    llm = get_llm(temperature=0)  # Low temperature for consistent routing
    return llm.with_structured_output(RouteDecision)


async def supervisor_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    Supervisor node that routes to specialized agents.
    
    This uses an LLM to intelligently decide which agent should handle
    the user's request based on the conversation context.
    """
    messages = state.get("messages", [])
    user_message = messages[-1].content if messages else 'Hello'
    
    logger.debug("="*60)
    logger.debug("SUPERVISOR NODE - Processing new request")
    logger.debug(f"User message: {user_message[:100]}{'...' if len(str(user_message)) > 100 else ''}")
    logger.debug(f"Message count in state: {len(messages)}")
    
    # Load user preferences from memory if available
    user_id = state.get("user_id", "default_user")
    user_prefs = get_user_preferences(user_id)
    if user_prefs:
        logger.debug(f"Loaded user preferences: {list(user_prefs.keys())}")
    
    # Get the routing decision from the supervisor LLM
    router = create_supervisor_router()
    
    # Build conversation context from recent messages (last 6 messages for context)
    recent_messages = messages[-6:] if len(messages) > 6 else messages
    conversation_context = ""
    if len(recent_messages) > 1:
        conversation_context = "\n\nRecent conversation context:\n"
        for msg in recent_messages[:-1]:  # All except the last (current) message
            role = "User" if isinstance(msg, HumanMessage) else "Assistant"
            content = msg.content[:200] + "..." if len(msg.content) > 200 else msg.content
            conversation_context += f"{role}: {content}\n"
    
    # Build the routing prompt with context
    routing_messages = [
        SystemMessage(content=SUPERVISOR_ROUTER_PROMPT),
        HumanMessage(content=f"Current user message: {user_message}{conversation_context}")
    ]
    
    try:
        logger.debug("Invoking router LLM for decision...")
        decision = router.invoke(routing_messages)  # type: RouteDecision
        
        task_type = "medicine" if decision.next_agent == "medicine_agent" else \
                    "travel" if decision.next_agent == "travel_agent" else "general"
        
        logger.debug(f"ROUTING DECISION: {decision.next_agent}")
        logger.debug(f"Task type: {task_type}")
        logger.debug(f"Reasoning: {decision.reasoning}")
        logger.debug(f"Task summary: {decision.task_summary}")
        logger.debug("="*60)
        
        return {
            "next_agent": decision.next_agent,
            "task_type": task_type,
            "iteration": state.get("iteration", 0) + 1,
        }
    except Exception as e:
        logger.error(f"Routing error: {e}")
        logger.warning("Defaulting to respond_directly")
        
        return {
            "next_agent": "respond_directly",
            "task_type": "general",
            "iteration": state.get("iteration", 0) + 1,
        }


# =============================================================================
# SPECIALIZED AGENTS
# =============================================================================

def create_medicine_agent():
    """
    Create the Medicine Finder Agent.
    
    This agent has its own LLM instance and specialized tools for:
    - Searching nearby pharmacies
    - Checking medicine availability
    - Simulating pharmacy calls
    """
    llm = get_llm(temperature=0.7)
    tools = get_medicine_tools()
    
    return create_react_agent(
        llm,
        tools=tools,
        prompt=MEDICINE_SYSTEM_PROMPT,
    )


def create_travel_agent():
    """
    Create the Travel Planner Agent.
    
    This agent has its own LLM instance and specialized tools for:
    - Gathering travel preferences
    - Generating detailed itineraries
    - Modifying and refining travel plans
    """
    llm = get_llm(temperature=0.8)  # Slightly higher for creative planning
    tools = get_travel_tools()
    
    return create_react_agent(
        llm,
        tools=tools,
        prompt=TRAVEL_SYSTEM_PROMPT,
    )


def medicine_agent_node(state: AgentState) -> dict:
    """Execute the medicine agent and return updated state."""
    messages = state.get("messages", [])
    logger.debug("="*60)
    logger.debug("MEDICINE AGENT ACTIVATED")
    logger.debug("Available tools: search_pharmacies, check_availability, call_pharmacy")
    logger.debug(f"Processing {len(messages)} messages")
    
    agent = create_medicine_agent()
    logger.debug("Invoking medicine agent...")
    
    result = agent.invoke({"messages": messages})
    
    new_messages = result.get("messages", [])
    logger.debug(f"Medicine agent completed. Generated {len(new_messages) - len(messages)} new message(s)")
    logger.debug("="*60)
    
    return {
        "messages": new_messages,
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "medicine_agent": "completed"
        }
    }


def travel_agent_node(state: AgentState) -> dict:
    """Execute the travel agent and return updated state."""
    messages = state.get("messages", [])
    logger.debug("="*60)
    logger.debug("TRAVEL AGENT ACTIVATED")
    logger.debug("Available tools: update_preferences, generate_itinerary, modify_itinerary, search_activities")
    logger.debug(f"Processing {len(messages)} messages")
    
    agent = create_travel_agent()
    logger.debug("Invoking travel agent...")
    
    result = agent.invoke({"messages": messages})
    
    new_messages = result.get("messages", [])
    logger.debug(f"Travel agent completed. Generated {len(new_messages) - len(messages)} new message(s)")
    logger.debug("="*60)
    
    return {
        "messages": new_messages,
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "travel_agent": "completed"
        }
    }


def direct_response_node(state: AgentState) -> dict:
    """Handle simple responses directly without specialized agents."""
    messages = state.get("messages", [])
    logger.debug("="*60)
    logger.debug("DIRECT RESPONSE NODE")
    logger.debug("No specialized agent needed - responding directly")
    logger.debug(f"Processing {len(messages)} messages")
    
    llm = get_llm(temperature=0.7)
    
    response = llm.invoke([
        SystemMessage(content="""You are a helpful assistant for Pokus AI.
You help users with medicine finding and travel planning.

If the user greets you, respond warmly and explain what you can help with:
1. Finding medicines at nearby pharmacies
2. Planning travel itineraries

Be concise and friendly."""),
        *messages
    ])
    
    return {
        "messages": messages + [response],
        "agent_outputs": {
            **state.get("agent_outputs", {}),
            "direct_response": "completed"
        }
    }


# =============================================================================
# MULTI-AGENT GRAPH
# =============================================================================

def route_to_agent(state: AgentState) -> Literal["medicine_agent", "travel_agent", "direct_response"]:
    """Conditional edge function to route to the appropriate agent."""
    next_agent = state.get("next_agent", "direct_response")
    
    logger.debug(f"GRAPH ROUTING: supervisor -> {next_agent}")
    
    if next_agent == "medicine_agent":
        return "medicine_agent"
    elif next_agent == "travel_agent":
        return "travel_agent"
    else:
        return "direct_response"


def create_supervisor_graph():
    """
    Create the multi-agent supervisor graph.
    
    This is the main entry point that creates a TRUE multi-agent system:
    
    1. Supervisor receives the user message
    2. Supervisor uses LLM to decide which agent to route to
    3. The selected agent processes the request with its own LLM
    4. Response is returned to the user
    
    Architecture:
        START → supervisor → [medicine_agent | travel_agent | direct_response] → END
    """
    # Build the state graph
    builder = StateGraph(AgentState)
    
    # Add all agent nodes
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("medicine_agent", medicine_agent_node)
    builder.add_node("travel_agent", travel_agent_node)
    builder.add_node("direct_response", direct_response_node)
    
    # Define the flow
    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges("supervisor", route_to_agent)
    
    # All agents end after processing
    builder.add_edge("medicine_agent", END)
    builder.add_edge("travel_agent", END)
    builder.add_edge("direct_response", END)
    
    # Compile with MemorySaver checkpointer (required for AG-UI protocol)
    memory = MemorySaver()
    graph = builder.compile(checkpointer=memory)
    
    logger.debug("MULTI-AGENT SYSTEM INITIALIZED")
    logger.debug("  Supervisor Agent: Routes requests intelligently")
    logger.debug("  Medicine Agent: Handles pharmacy/medicine tasks")
    logger.debug("  Travel Agent: Handles travel planning tasks")
    
    return graph


# =============================================================================
# LEGACY SINGLE-AGENT (kept for reference)
# =============================================================================

def create_single_agent_graph():
    """
    Legacy single-agent implementation.
    Kept for comparison - uses one agent with all tools.
    """
    llm = get_llm()
    all_tools = get_medicine_tools() + get_travel_tools()
    
    return create_react_agent(
        llm,
        tools=all_tools,
        prompt="""You are a helpful AI assistant for Pokus AI.
You can help with finding medicines at pharmacies and planning travel itineraries.
Use the appropriate tools based on what the user needs.""",
    )
