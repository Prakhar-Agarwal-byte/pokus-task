"""
Pokus AI Agents - Multi-agent system for real-world task completion.

This FastAPI application provides the backend agent infrastructure for
the Pokus AI task completion system. It uses LangGraph for agent orchestration
and CopilotKit for frontend integration.
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from copilotkit import LangGraphAGUIAgent
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from src.agents.supervisor import create_supervisor_graph
from src.task_registry import initialize_default_tasks, get_registry
from langchain_core.messages import HumanMessage
import logging

# Configure logging - use INFO level for production (reduce verbosity)
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s - %(levelname)s - %(message)s",
    force=True
)
# Reduce noise from third-party libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("langchain").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)
# Load environment variables
load_dotenv()

# Initialize task registry with default tasks
initialize_default_tasks()

# Create FastAPI app
app = FastAPI(
    title="Pokus AI Agents",
    description="Multi-agent system for real-world task completion",
    version="0.1.0",
)

# Log startup
logger.info("🚀 Pokus AI Agents starting...")

# Store startup time for health checks
startup_time = datetime.now()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint (used by Docker healthcheck)
@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration."""
    logger.debug("Health check requested")
    registry = get_registry()
    uptime = (datetime.now() - startup_time).total_seconds()
    
    return {
        "status": "healthy",
        "version": "0.1.0",
        "uptime_seconds": round(uptime, 2),
        "tasks_registered": len(registry.get_all_tasks()),
        "tasks_enabled": len(registry.get_enabled_tasks()),
        "llm_provider": "openai",
        "web_search": "tavily" if os.getenv("TAVILY_API_KEY") else "simulated",
    }


# Task registry endpoint (for frontend to discover available tasks)
@app.get("/tasks")
async def list_tasks():
    """List all available tasks for the frontend."""
    registry = get_registry()
    tasks = registry.to_frontend_manifest()
    return {
        "tasks": tasks,
        "total": len(registry.get_all_tasks()),
    }


# Create the supervisor graph
supervisor_graph = create_supervisor_graph()

# Add LangGraph agent endpoint using AG-UI protocol
add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(
        name="supervisor",
        description="Main supervisor agent that routes tasks to specialized agents",
        graph=supervisor_graph,
    ),
    path="/",
)

# Test endpoint to directly invoke the graph
@app.post("/test-graph")
async def test_graph(message: str = "Find me ibuprofen near San Francisco"):
    """Test endpoint to directly invoke the supervisor graph."""
    try:
        result = await supervisor_graph.ainvoke({
            "messages": [HumanMessage(content=message)],
            "next_agent": "",
            "task_type": "",
            "agent_outputs": {},
            "iteration": 0,
        })
        
        # Extract the last message
        last_message = result["messages"][-1].content if result["messages"] else "No response"
        
        return {
            "success": True,
            "response": last_message,
            "task_type": result.get("task_type"),
            "agent_used": result.get("next_agent"),
        }
    except Exception as e:
        logger.error(f"Test graph error: {e}")
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")
