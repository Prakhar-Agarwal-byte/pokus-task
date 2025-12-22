"""
Task Registry - Scalable pattern for registering new task types.

This module demonstrates how to add new tasks to the multi-agent system
without modifying core agent code. Each task is self-contained with:
- Tools (what actions the agent can perform)
- System prompt (specialized instructions)
- UI metadata (for frontend rendering)

To add a new task:
1. Create a new agent file (e.g., src/agents/plumber.py)
2. Implement get_tools() and SYSTEM_PROMPT
3. Register it here with register_task()
4. Add the corresponding frontend page

This pattern allows the system to scale to unlimited task types.
"""

import logging
from dataclasses import dataclass, field
from typing import Callable, Any
from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)


@dataclass
class TaskDefinition:
    """Definition of a task type in the system."""
    id: str                                    # Unique identifier (e.g., "medicine")
    name: str                                  # Display name (e.g., "Find Medicine")
    description: str                           # What this task does
    icon: str                                  # Icon name for UI (e.g., "pill", "plane")
    color: str                                 # Theme color (e.g., "emerald", "blue")
    keywords: list[str]                        # Keywords for routing
    get_tools: Callable[[], list[BaseTool]]   # Function that returns the task's tools
    system_prompt: str                         # Specialized system prompt
    category: str = "general"                  # Category grouping
    enabled: bool = True                       # Whether task is active
    metadata: dict = field(default_factory=dict)  # Additional metadata


class TaskRegistry:
    """
    Central registry for all task types in the system.
    
    Provides:
    - Dynamic task registration
    - Task lookup by ID or keywords
    - Tool aggregation for supervisor agent
    - Metadata for frontend rendering
    """
    
    def __init__(self):
        self._tasks: dict[str, TaskDefinition] = {}
        self._keyword_index: dict[str, str] = {}  # keyword -> task_id
    
    def register(self, task: TaskDefinition) -> None:
        """Register a new task type."""
        self._tasks[task.id] = task
        
        # Build keyword index for routing
        for keyword in task.keywords:
            self._keyword_index[keyword.lower()] = task.id
        
        logger.debug(f"Registered task: {task.name} ({task.id}) with {len(task.keywords)} keywords")
    
    def get_task(self, task_id: str) -> TaskDefinition | None:
        """Get a task by its ID."""
        return self._tasks.get(task_id)
    
    def get_all_tasks(self) -> list[TaskDefinition]:
        """Get all registered tasks."""
        return list(self._tasks.values())
    
    def get_enabled_tasks(self) -> list[TaskDefinition]:
        """Get only enabled tasks."""
        return [t for t in self._tasks.values() if t.enabled]
    
    def find_task_by_keyword(self, text: str) -> TaskDefinition | None:
        """Find a task based on keywords in the text."""
        text_lower = text.lower()
        for keyword, task_id in self._keyword_index.items():
            if keyword in text_lower:
                return self._tasks.get(task_id)
        return None
    
    def get_all_tools(self) -> list[BaseTool]:
        """Get all tools from all enabled tasks."""
        tools = []
        for task in self.get_enabled_tasks():
            tools.extend(task.get_tools())
        return tools
    
    def get_task_tools(self, task_id: str) -> list[BaseTool]:
        """Get tools for a specific task."""
        task = self.get_task(task_id)
        if task:
            return task.get_tools()
        return []
    
    def get_routing_info(self) -> dict:
        """Get information for the supervisor's routing decisions."""
        return {
            task.id: {
                "name": task.name,
                "description": task.description,
                "keywords": task.keywords,
            }
            for task in self.get_enabled_tasks()
        }
    
    def to_frontend_manifest(self) -> list[dict]:
        """Generate manifest for frontend task selection."""
        return [
            {
                "id": task.id,
                "name": task.name,
                "description": task.description,
                "icon": task.icon,
                "color": task.color,
                "category": task.category,
                "enabled": task.enabled,
            }
            for task in self._tasks.values()
        ]


# Global registry instance
_registry = TaskRegistry()


def get_registry() -> TaskRegistry:
    """Get the global task registry."""
    return _registry


def register_task(task: TaskDefinition) -> None:
    """Register a task with the global registry."""
    _registry.register(task)


def initialize_default_tasks() -> None:
    """Initialize the registry with default tasks."""
    from src.agents.medicine import get_medicine_tools, MEDICINE_SYSTEM_PROMPT
    from src.agents.travel import get_travel_tools, TRAVEL_SYSTEM_PROMPT
    
    # Register Medicine Finder task
    register_task(TaskDefinition(
        id="medicine",
        name="Find Medicine",
        description="Locate medicines at nearby pharmacies, check availability, and reserve for pickup",
        icon="pill",
        color="emerald",
        keywords=[
            "medicine", "pharmacy", "drug", "medication", "prescription",
            "paracetamol", "ibuprofen", "aspirin", "antibiotic", "pill",
            "drugstore", "cvs", "walgreens", "rite aid"
        ],
        get_tools=get_medicine_tools,
        system_prompt=MEDICINE_SYSTEM_PROMPT,
        category="health",
        metadata={
            "simulated_features": ["pharmacy_call"],
            "real_features": ["pharmacy_search"],
        }
    ))
    
    # Register Travel Planner task
    register_task(TaskDefinition(
        id="travel",
        name="Plan Travel",
        description="Create detailed travel itineraries with activities, restaurants, and logistics",
        icon="plane",
        color="blue",
        keywords=[
            "travel", "trip", "vacation", "holiday", "itinerary",
            "flight", "hotel", "destination", "bali", "tokyo", "paris",
            "adventure", "beach", "mountain", "city break"
        ],
        get_tools=get_travel_tools,
        system_prompt=TRAVEL_SYSTEM_PROMPT,
        category="lifestyle",
        metadata={
            "simulated_features": ["booking"],
            "real_features": ["destination_search", "activity_search"],
        }
    ))
    
    logger.debug(f"Initialized {len(_registry.get_all_tasks())} tasks in registry")


# Example: How to add a new task (e.g., Plumber Booking)
"""
To add a new "Book Plumber" task:

1. Create src/agents/plumber.py:
   ```python
   from langchain_core.tools import tool
   
   PLUMBER_SYSTEM_PROMPT = '''You help users find and book plumbers...'''
   
   @tool
   def search_plumbers(location: str, service_type: str) -> list[dict]:
       '''Search for plumbers in the area'''
       # Implementation...
   
   @tool  
   def book_appointment(plumber_id: str, date: str, time: str) -> dict:
       '''Book an appointment with a plumber'''
       # Implementation...
   
   def get_plumber_tools():
       return [search_plumbers, book_appointment]
   ```

2. Register in this file:
   ```python
   from src.agents.plumber import get_plumber_tools, PLUMBER_SYSTEM_PROMPT
   
   register_task(TaskDefinition(
       id="plumber",
       name="Book Plumber",
       description="Find and book plumbers for home repairs",
       icon="wrench",
       color="orange",
       keywords=["plumber", "plumbing", "leak", "pipe", "drain", "faucet"],
       get_tools=get_plumber_tools,
       system_prompt=PLUMBER_SYSTEM_PROMPT,
       category="home_services",
   ))
   ```

3. Create frontend page: apps/web/app/tasks/plumber/page.tsx

That's it! The supervisor will automatically route plumber-related requests
to the new task's tools.
"""
