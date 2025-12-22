"""
Travel Planner Agent - Tools and logic for creating travel itineraries.

This module provides tools for:
- Gathering travel preferences (with state persistence)
- Generating multi-day itineraries (with real web search and streaming progress)
- Modifying and refining plans
- Searching for activities (with real web search)
"""

import logging
import random
import asyncio
import os
import json
from datetime import datetime, timedelta
from typing import Optional, Literal
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

# CopilotKit imports for streaming state
from copilotkit.langgraph import copilotkit_emit_state, copilotkit_customize_config

logger = logging.getLogger(__name__)


def get_itinerary_llm():
    """Get LLM instance for itinerary synthesis."""
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.7,
    )

# Import web search utilities
from src.utils.web_search import search_destination_info, search_activities_web


# System prompt for the travel agent
TRAVEL_SYSTEM_PROMPT = """You are an enthusiastic travel planning assistant. Your PRIMARY goal is to ask follow-up questions to gather ALL required information BEFORE creating any itinerary.

## REQUIRED INFORMATION (ask for these if missing):
1. **Destination** - Where do they want to go? (city, country, or region)
2. **Dates** - When are they traveling? (exact dates or approximate duration)
3. **Budget** - What's their budget level? (budget/moderate/luxury)
4. **Travelers** - How many people? Any kids or special needs?
5. **Interests** - What do they enjoy? (culture, food, adventure, relaxation, nightlife, nature, shopping)
6. **Pace** - How packed should the itinerary be? (relaxed/moderate/packed)
7. **Special requests** - Any must-see places or dietary restrictions?

## CONVERSATION FLOW:
1. **FIRST** - Greet warmly and show excitement about their trip!
2. **THEN** - Ask questions ONE or TWO at a time to not overwhelm
3. **BUILD** - Store preferences as you learn them using update_preferences
4. **CONFIRM** - Summarize the trip details before generating itinerary
5. **CREATE** - Only use generate_itinerary when you have enough info
6. **REFINE** - Ask if they want to modify any day

## EXAMPLE FOLLOW-UPS:
- "Exciting! Where are you thinking of going? Any destinations on your bucket list?"
- "When are you planning to travel? Even approximate dates help me plan better."
- "What's your budget like for this trip - are you looking for budget-friendly options, something moderate, or ready to splurge on luxury?"
- "Who's coming with you? Number of travelers helps me plan activities and costs."
- "What kind of experiences do you enjoy most? For example: cultural sites, local food, adventure activities, relaxing beaches, or shopping?"
- "Do you prefer a relaxed pace with downtime, or do you want to pack in as much as possible?"

## IMPORTANT:
- NEVER generate an itinerary without destination AND dates AND budget
- Be enthusiastic! Travel planning should feel exciting
- Confirm before generating: "So you're planning a X-day trip to Y on a Z budget, focusing on A and B. Sound right?"
- All destination info is fetched from Tavily web search for real-time, accurate data
- Offer to modify any day based on feedback
- Make the itinerary practical and realistic for actual travel"""


class TravelPreferences(BaseModel):
    """User's travel preferences."""
    destination: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[Literal["budget", "moderate", "luxury"]] = None
    interests: Optional[list[str]] = None
    pace: Optional[Literal["relaxed", "moderate", "packed"]] = None
    travelers: Optional[int] = None


@tool
def update_preferences(
    destination: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    budget: Optional[str] = None,
    interests: Optional[str] = None,
    pace: Optional[str] = None,
    travelers: Optional[int] = None,
) -> dict:
    """
    Update travel preferences as they are gathered from the user.
    
    Args:
        destination: Travel destination city or country
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        budget: Budget level - 'budget', 'moderate', or 'luxury'
        interests: Comma-separated list of interests (culture, food, adventure, relaxation, shopping, art, nature)
        pace: Trip pace - 'relaxed', 'moderate', or 'packed'
        travelers: Number of travelers
    
    Returns:
        Updated preferences summary
    """
    logger.debug(f"[TOOL] update_preferences called")
    
    updated = {}
    
    if destination:
        updated["destination"] = destination
    if start_date:
        updated["start_date"] = start_date
    if end_date:
        updated["end_date"] = end_date
    if budget:
        updated["budget"] = budget
    if interests:
        updated["interests"] = [i.strip() for i in interests.split(",")]
    if pace:
        updated["pace"] = pace
    if travelers:
        updated["travelers"] = travelers
    
    logger.debug(f"  Updated {len(updated)} preference(s): {list(updated.keys())}")
    
    return {
        "success": True,
        "updated_preferences": updated,
        "message": f"Updated {len(updated)} preference(s): {', '.join(updated.keys())}",
    }


@tool
def generate_itinerary(
    destination: str,
    start_date: str,
    end_date: str,
    budget: str = "moderate",
    interests: str = "culture,food,nature",
    pace: str = "moderate",
) -> dict:
    """
    Research a destination and provide data for creating a travel itinerary.
    Uses Tavily web search to get real destination data with AI-synthesized recommendations.
    
    The tool returns destination research - the LLM should use this to create
    a detailed day-by-day itinerary with specific places, times, and costs.
    
    Args:
        destination: Travel destination
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        budget: Budget level - 'budget', 'moderate', or 'luxury'
        interests: Comma-separated interests
        pace: Trip pace - 'relaxed', 'moderate', or 'packed'
    
    Returns:
        Destination research data for the LLM to create the itinerary
    """
    logger.debug(f"[TOOL] generate_itinerary called")
    logger.debug(f"  Destination: {destination}")
    logger.debug(f"  Dates: {start_date} to {end_date}")
    logger.debug(f"  Budget: {budget}")
    logger.debug(f"  Interests: {interests}")
    logger.debug(f"  Pace: {pace}")
    
    # Parse dates
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        start = datetime.now()
        end = start + timedelta(days=5)
    
    num_days = (end - start).days
    num_days = min(num_days, 14)  # Cap at 14 days
    
    logger.debug(f"  Trip duration: {num_days} days")
    
    # Parse interests
    interest_list = [i.strip().lower() for i in interests.split(",")]
    
    # Get real destination info from web search (now with AI-synthesized answer)
    logger.debug(f"  Fetching destination info from Tavily...")
    web_data = search_destination_info(destination, interest_list)
    
    if not web_data.get("success"):
        error_msg = web_data.get("error", "Unknown error occurred")
        logger.error(f"Tavily search failed for {destination}: {error_msg}")
        return {
            "error": True,
            "message": f"Could not fetch destination info for {destination}: {error_msg}",
            "suggestion": "Please ensure the Tavily API key is configured correctly, or try again later.",
        }
    
    logger.debug(f"  SUCCESS: Fetched destination data from Tavily")
    
    # Get the AI-synthesized answer with real place names
    destination_info = web_data.get("answer", "")
    sources = web_data.get("sources", [])
    
    logger.debug(f"  Got destination info: {len(destination_info)} chars")
    
    # Budget guidance for the LLM
    budget_guidance = {
        "budget": "Focus on free attractions, street food, budget hostels. Daily budget: $30-50.",
        "moderate": "Mix of paid attractions and free activities, mid-range restaurants. Daily budget: $100-150.",
        "luxury": "Premium experiences, fine dining, luxury accommodations. Daily budget: $300+.",
    }
    
    # Pace guidance
    pace_guidance = {
        "relaxed": "2-3 activities per day with plenty of rest time",
        "moderate": "3-4 activities per day with breaks",
        "packed": "5-6 activities per day, maximize the experience",
    }
    
    # Build date list for itinerary
    dates = []
    for day_num in range(num_days):
        current_date = start + timedelta(days=day_num)
        dates.append({
            "day": day_num + 1,
            "date": current_date.strftime("%Y-%m-%d"),
            "weekday": current_date.strftime("%A"),
        })
    
    # Format source snippets for LLM (contains pricing info)
    source_content = "\n".join([s.get("snippet", "") for s in sources if s.get("snippet")])
    
    # Use internal LLM to synthesize structured itinerary from research
    logger.debug("  Synthesizing structured itinerary with LLM...")
    
    llm = get_itinerary_llm()
    
    # Build dates string for the prompt
    dates_str = "\n".join([f"Day {d['day']}: {d['date']} ({d['weekday']})" for d in dates])
    
    synthesis_prompt = f"""Based on this research about {destination}, create a detailed {num_days}-day travel itinerary.

DESTINATION RESEARCH:
{destination_info}

TRIP DETAILS:
- Dates:
{dates_str}
- Budget: {budget} - {budget_guidance.get(budget, budget_guidance['moderate'])}
- Pace: {pace} - {pace_guidance.get(pace, pace_guidance['moderate'])}
- Interests: {', '.join(interest_list)}

CREATE EXACTLY {num_days} DAYS with 3-5 activities each. Use REAL place names from the research above.

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{{
  "itinerary": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "Day Theme (e.g., Arrival & Exploration)",
      "activities": [
        {{
          "time": "9:00 AM",
          "title": "Activity Name",
          "description": "Brief description of activity",
          "duration": "2 hours",
          "type": "attraction",
          "cost": 25,
          "location": "Location Name"
        }}
      ]
    }}
  ],
  "total_cost": 500
}}

Activity types: attraction, food, transport, accommodation, activity
Make costs realistic for the {budget} budget level."""
    
    try:
        response = llm.invoke(synthesis_prompt)
        response_text = response.content.strip()
        
        # Clean up response - remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        itinerary_data = json.loads(response_text)
        
        # Add IDs to activities for frontend
        for day in itinerary_data.get("itinerary", []):
            for idx, act in enumerate(day.get("activities", [])):
                act["id"] = f"day{day['day']}-act{idx + 1}"
        
        logger.debug(f"  SUCCESS: Generated {len(itinerary_data.get('itinerary', []))}-day structured itinerary")
        
        return {
            "success": True,
            "destination": destination,
            "num_days": num_days,
            "start_date": start_date,
            "end_date": end_date,
            "budget_level": budget,
            "pace": pace,
            "interests": interest_list,
            "itinerary": itinerary_data.get("itinerary", []),
            "total_cost": itinerary_data.get("total_cost", 0),
            "tips": [
                "Book popular attractions in advance",
                "Consider travel insurance for your trip",
                "Download offline maps before you go",
                "Check visa requirements for your destination",
            ],
            "message": f"Created a {num_days}-day itinerary for {destination}! Check the left panel for details.",
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse itinerary JSON: {e}")
        logger.error(f"Response was: {response_text[:500]}...")
        return {
            "error": True,
            "message": f"Failed to generate structured itinerary. Please try again.",
            "destination": destination,
            "num_days": num_days,
        }
    except Exception as e:
        logger.error(f"Error synthesizing itinerary: {e}")
        return {
            "error": True,
            "message": f"Error creating itinerary: {str(e)}",
            "destination": destination,
            "num_days": num_days,
        }


@tool
def modify_itinerary(
    day: int,
    action: str,
    activity_index: Optional[int] = None,
    new_activity_title: Optional[str] = None,
    new_activity_description: Optional[str] = None,
    new_activity_time: Optional[str] = None,
) -> dict:
    """
    Modify a specific day in the itinerary.
    
    Args:
        day: Day number to modify (1-indexed)
        action: Action to perform - 'remove', 'add', or 'replace'
        activity_index: Index of activity to modify (for remove/replace)
        new_activity_title: Title for new activity (for add/replace)
        new_activity_description: Description for new activity
        new_activity_time: Time for new activity (e.g., "14:00")
    
    Returns:
        Confirmation of the modification
    """
    logger.debug(f"[TOOL] modify_itinerary called")
    logger.debug(f"  Day: {day}, Action: {action}")
    if activity_index is not None:
        logger.debug(f"  Activity index: {activity_index}")
    if new_activity_title:
        logger.debug(f"  New activity: {new_activity_title}")
    
    if action == "remove":
        return {
            "success": True,
            "action": "remove",
            "day": day,
            "activity_index": activity_index,
            "message": f"Removed activity {activity_index} from day {day}",
        }
    elif action == "add":
        return {
            "success": True,
            "action": "add",
            "day": day,
            "new_activity": {
                "title": new_activity_title,
                "description": new_activity_description,
                "time": new_activity_time,
            },
            "message": f"Added '{new_activity_title}' to day {day} at {new_activity_time}",
        }
    elif action == "replace":
        return {
            "success": True,
            "action": "replace",
            "day": day,
            "activity_index": activity_index,
            "new_activity": {
                "title": new_activity_title,
                "description": new_activity_description,
                "time": new_activity_time,
            },
            "message": f"Replaced activity {activity_index} on day {day} with '{new_activity_title}'",
        }
    
    return {"success": False, "message": f"Unknown action: {action}"}


@tool
def search_activities(
    destination: str,
    activity_type: str,
    budget: str = "moderate",
) -> dict:
    """
    Search for specific types of activities at a destination.
    Uses Tavily web search with AI synthesis for real place recommendations.
    
    Args:
        destination: The destination to search in
        activity_type: Type of activity (culture, food, adventure, relaxation, shopping, art, nature)
        budget: Budget level - 'budget', 'moderate', or 'luxury'
    
    Returns:
        AI-synthesized recommendations with real place names
    """
    logger.debug(f"[TOOL] search_activities called")
    logger.debug(f"  Destination: {destination}")
    logger.debug(f"  Activity type: {activity_type}")
    logger.debug(f"  Budget: {budget}")
    
    # Use web search with AI synthesis
    logger.debug(f"  Searching Tavily for activities...")
    web_results = search_activities_web(destination, activity_type, budget)
    
    if web_results.get("success") and web_results.get("answer"):
        answer = web_results["answer"]
        sources = web_results.get("sources", [])
        logger.debug(f"  SUCCESS: Got AI-synthesized answer ({len(answer)} chars)")
        return {
            "success": True,
            "destination": destination,
            "activity_type": activity_type,
            "recommendations": answer,  # AI-synthesized with real place names
            "sources": sources,
            "from_web_search": True,
            "message": f"Found {activity_type} recommendations in {destination} (AI-synthesized from Tavily)",
        }
    
    # Return error if web search fails
    error_msg = web_results.get("error", "Unknown error occurred")
    logger.error(f"  FAILED: Tavily search error - {error_msg}")
    
    return {
        "error": True,
        "message": f"Could not search for {activity_type} activities in {destination}: {error_msg}",
        "suggestion": "Please ensure the Tavily API key is configured correctly, or try again later.",
    }


def get_travel_tools():
    """Get all tools for the travel planner agent."""
    return [
        update_preferences,
        generate_itinerary,
        modify_itinerary,
        search_activities,
    ]
