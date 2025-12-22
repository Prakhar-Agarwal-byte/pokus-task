"""
Medicine Finder Agent - Tools and logic for finding medicines and pharmacies.

This module provides tools for:
- Searching nearby pharmacies (with real web search + internal LLM synthesis)
- Checking medicine availability
- Simulating pharmacy calls (with human-in-the-loop confirmation)
"""

import logging
import random
import time
import os
import json
from typing import Optional, Annotated
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

# CopilotKit imports for streaming state
from copilotkit.langgraph import copilotkit_emit_state, copilotkit_customize_config

logger = logging.getLogger(__name__)

# Import web search utilities
from src.utils.web_search import search_pharmacies_web, search_medicine_availability


def get_pharmacy_llm():
    """Get LLM instance for pharmacy data synthesis."""
    return ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,  # Lower temp for more consistent structured output
    )


# System prompt for the medicine agent
MEDICINE_SYSTEM_PROMPT = """You are a helpful medicine finder assistant. Your PRIMARY goal is to ask follow-up questions to gather ALL required information BEFORE taking any action.

## REQUIRED INFORMATION (ask for these if missing):
1. **Medicine name** - What medicine are they looking for? Be specific (brand name, generic, dosage if relevant)
2. **Location** - Where should we search? (city, neighborhood, or address)
3. **Urgency** - Is this urgent? Do they need 24-hour pharmacies?
4. **Quantity** - How much do they need?
5. **Preferences** - Any pharmacy chain preferences? Insurance considerations?

## CONVERSATION FLOW:
1. **FIRST** - Greet warmly and understand their need
2. **THEN** - Ask clarifying questions ONE or TWO at a time (don't overwhelm)
3. **CONFIRM** - Summarize what you understood before searching
4. **SEARCH** - Only use searchPharmacies when you have medicine + location
5. **GUIDE** - Help them through availability checking and pharmacy calls

## EXAMPLE FOLLOW-UPS:
- "What medicine are you looking for? If you know the dosage or form (tablets, liquid, etc.), that helps too!"
- "Where should I search? You can give me a city, neighborhood, or specific address."
- "Is this urgent? I can prioritize 24-hour pharmacies if needed."
- "How many do you need? This helps me check if pharmacies have enough stock."

## IMPORTANT:
- NEVER search without knowing both medicine AND location
- Be conversational and empathetic - finding medicine can be stressful
- Confirm details before taking action: "Just to confirm, you're looking for X near Y?"
- For pharmacy calls, remind the user that this is a SIMULATED call for demonstration purposes
- All pharmacy searches use Tavily web search for real-time data.
- Availability checking and pharmacy calls are simulated for demonstration."""


class PharmacyResult(BaseModel):
    """A pharmacy search result."""
    id: str
    name: str
    address: str
    distance_km: float
    phone: str
    is_open: bool
    hours: str
    rating: float


class AvailabilityResult(BaseModel):
    """Medicine availability result."""
    pharmacy_id: str
    pharmacy_name: str
    in_stock: bool
    quantity: Optional[int] = None
    price_per_unit: Optional[float] = None


class CallResult(BaseModel):
    """Simulated pharmacy call result."""
    success: bool
    pharmacy_name: str
    medicine: str
    available: bool
    quantity: Optional[int] = None
    price: Optional[float] = None
    reserved: bool = False
    transcript: list[str]
    note: str = "⚠️ This is a SIMULATED call for demonstration purposes only."


@tool
def search_pharmacies(
    medicine_name: str,
    location: str,
    radius_km: float = 5.0,
) -> dict:
    """
    Search for pharmacies near a location that might have a specific medicine.
    Uses Tavily web search to find real pharmacy data, then internal LLM to structure it.
    
    Args:
        medicine_name: The name of the medicine to search for
        location: The location to search near (address, city, or coordinates)
        radius_km: Search radius in kilometers (default: 5km)
    
    Returns:
        Structured pharmacy data with success status and pharmacy list
    """
    logger.debug(f"[TOOL] search_pharmacies called")
    logger.debug(f"  Medicine: {medicine_name}")
    logger.debug(f"  Location: {location}")
    logger.debug(f"  Radius: {radius_km}km")
    
    # Call Tavily web search to get pharmacy research
    logger.debug("  Calling Tavily web search...")
    web_results = search_pharmacies_web(medicine_name, location, radius_km)
    
    if not web_results.get("success"):
        error_msg = web_results.get("error", "Unknown error occurred")
        logger.error(f"  FAILED: Tavily search error - {error_msg}")
        return {
            "error": True,
            "message": f"Could not search for pharmacies: {error_msg}",
            "suggestion": "Please ensure the Tavily API key is configured correctly, or try again later.",
        }
    
    # Get the AI-synthesized answer
    pharmacy_info = web_results.get("answer", "")
    sources = web_results.get("sources", [])
    
    logger.debug(f"  Got pharmacy info: {len(pharmacy_info)} chars")
    
    # Use internal LLM to synthesize structured pharmacy data
    logger.debug("  Synthesizing structured pharmacy data with LLM...")
    
    llm = get_pharmacy_llm()
    
    # Format source snippets for additional context
    source_content = "\n".join([s.get("snippet", "") for s in sources if s.get("snippet")])
    
    synthesis_prompt = f"""Based on this research about pharmacies, extract structured pharmacy data.

PHARMACY RESEARCH:
{pharmacy_info}

ADDITIONAL SOURCE CONTEXT:
{source_content[:2000]}

SEARCH DETAILS:
- Medicine: {medicine_name}
- Location: {location}

Extract UP TO 5 pharmacies from the research. Use REAL pharmacy names and addresses from the research above.
If specific details are not available, use reasonable estimates or "Contact for details".

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{{
  "pharmacies": [
    {{
      "id": "pharmacy_1",
      "name": "Pharmacy Name",
      "address": "Full address or 'Near [location]'",
      "phone": "Phone number or 'Contact via website'",
      "hours": "Operating hours or 'Check website for hours'",
      "distance_km": 1.5,
      "rating": 4.2,
      "is_open": true,
      "has_medicine": true,
      "estimated_price": 25.00,
      "notes": "Any special notes about this pharmacy"
    }}
  ],
  "total_found": 5,
  "search_summary": "Brief summary of what was found"
}}

Make distance_km values between 0.5 and {radius_km}. Make ratings between 3.5 and 4.9."""
    
    try:
        response = llm.invoke(synthesis_prompt)
        response_text = response.content.strip()
        
        # Clean up response - remove markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
        
        pharmacy_data = json.loads(response_text)
        
        # Ensure IDs are set
        for idx, pharmacy in enumerate(pharmacy_data.get("pharmacies", [])):
            pharmacy["id"] = pharmacy.get("id") or f"pharmacy_{idx + 1}"
            pharmacy["from_web_search"] = True
        
        logger.debug(f"  SUCCESS: Extracted {len(pharmacy_data.get('pharmacies', []))} pharmacies")
        
        return {
            "success": True,
            "medicine_name": medicine_name,
            "location": location,
            "pharmacies": pharmacy_data.get("pharmacies", []),
            "total_found": pharmacy_data.get("total_found", len(pharmacy_data.get("pharmacies", []))),
            "search_summary": pharmacy_data.get("search_summary", f"Found pharmacies near {location} for {medicine_name}"),
            "message": f"Found {len(pharmacy_data.get('pharmacies', []))} pharmacies near {location}. Check the left panel for details.",
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse pharmacy JSON: {e}")
        logger.error(f"Response was: {response_text[:500]}...")
        return {
            "error": True,
            "message": "Failed to process pharmacy data. Please try again.",
        }
    except Exception as e:
        logger.error(f"Error synthesizing pharmacy data: {e}")
        return {
            "error": True,
            "message": f"Error processing pharmacy search: {str(e)}",
        }


@tool
def check_availability(
    pharmacy_id: str,
    medicine_name: str,
    pharmacy_name: str = "",
    location: str = "",
) -> dict:
    """
    Check if a specific pharmacy has the medicine in stock.
    Uses web search for pricing info and simulates availability status.
    
    Args:
        pharmacy_id: The ID of the pharmacy to check
        medicine_name: The name of the medicine to check for
        pharmacy_name: Name of the pharmacy (for web search)
        location: Location for context (for web search)
    
    Returns:
        Availability information including stock status and price
    """
    logger.debug(f"[TOOL] check_availability called")
    logger.debug(f"  Pharmacy ID: {pharmacy_id}")
    logger.debug(f"  Pharmacy Name: {pharmacy_name}")
    logger.debug(f"  Medicine: {medicine_name}")
    
    web_data = None
    
    # Try web search for real availability/pricing info
    if pharmacy_name and location:
        logger.debug(f"  Searching web for availability info...")
        web_result = search_medicine_availability(pharmacy_name, medicine_name, location)
        if web_result.get("success"):
            logger.debug(f"  Found web data for {medicine_name}")
            web_data = web_result
        else:
            logger.debug(f"  No web data found, using simulation")
    
    # Simulate API delay
    time.sleep(0.3)
    
    # Use provided pharmacy_name or generate from ID
    if not pharmacy_name:
        pharmacy_name = f"Pharmacy {pharmacy_id}"
    
    # Simulate availability (70% chance of having stock)
    in_stock = random.random() > 0.3
    quantity = random.randint(5, 100) if in_stock else 0
    price = round(random.uniform(5, 25), 2) if in_stock else None
    
    result = {
        "pharmacy_id": pharmacy_id,
        "pharmacy_name": pharmacy_name,
        "medicine": medicine_name,
        "in_stock": in_stock,
        "quantity": quantity,
        "price_per_unit": price,
        "message": f"{'✅ In stock' if in_stock else '❌ Out of stock'} at {pharmacy_name}",
        "note": "⚠️ Availability is simulated for demonstration. Call pharmacy to confirm actual stock.",
    }
    
    # Add web search data if available
    if web_data:
        result["web_search_info"] = web_data.get("search_content", "")
        result["sources"] = web_data.get("sources", [])
    
    return result


@tool
def call_pharmacy(
    pharmacy_id: str,
    pharmacy_name: str,
    medicine_name: str,
    quantity_needed: int = 1,
) -> dict:
    """
    Simulate calling a pharmacy to confirm availability and reserve medicine.
    
    This is a SIMULATED call for demonstration purposes. No real calls are made.
    The agent should confirm with the user before calling this tool.
    
    Args:
        pharmacy_id: The ID of the pharmacy to call
        pharmacy_name: The name of the pharmacy
        medicine_name: The name of the medicine to inquire about
        quantity_needed: How many units needed (default: 1)
    
    Returns:
        Call result with simulated transcript and availability info
    """
    logger.debug(f"[TOOL] call_pharmacy called (SIMULATED)")
    logger.debug(f"  Pharmacy: {pharmacy_name} (ID: {pharmacy_id})")
    logger.debug(f"  Medicine: {medicine_name}")
    logger.debug(f"  Quantity needed: {quantity_needed}")
    
    # Simulate call duration
    logger.debug(f"  Simulating call...")
    time.sleep(1.0)
    
    # Simulate call outcome (80% success rate)
    available = random.random() > 0.2
    quantity = random.randint(10, 50) if available else 0
    price = round(random.uniform(5, 20), 2) if available else 0
    
    logger.debug(f"  Simulated call result: {'Available' if available else 'Not available'}")
    if available:
        logger.debug(f"  Quantity: {quantity}, Price: ${price}")
    
    # Generate simulated transcript
    if available:
        transcript = [
            f"Pharmacist: Thank you for calling {pharmacy_name}, how can I help you?",
            f"Customer: Hi, I'm looking for {medicine_name}. Do you have it in stock?",
            f"Pharmacist: Let me check... Yes, we do have {medicine_name} in stock.",
            f"Pharmacist: We currently have {quantity} units available at ${price:.2f} each.",
            f"Customer: Great! Can I reserve {quantity_needed} unit(s)?",
            f"Pharmacist: Absolutely! I've reserved {quantity_needed} unit(s) under your name.",
            f"Pharmacist: The reservation will be held for 2 hours. Is there anything else?",
            "Customer: No, that's all. Thank you!",
            f"Pharmacist: You're welcome! See you soon at {pharmacy_name}. Goodbye!",
        ]
        message = f"✅ {medicine_name} is available at {pharmacy_name}. {quantity} units in stock at ${price:.2f} each. Reserved {quantity_needed} unit(s) for pickup."
    else:
        transcript = [
            f"Pharmacist: Thank you for calling {pharmacy_name}, how can I help you?",
            f"Customer: Hi, I'm looking for {medicine_name}. Do you have it in stock?",
            f"Pharmacist: Let me check... I'm sorry, we're currently out of {medicine_name}.",
            "Pharmacist: We expect a new shipment in 2-3 business days.",
            "Customer: I see. Do you know any nearby pharmacies that might have it?",
            "Pharmacist: You might want to try CVS on Main Street, they usually have larger stock.",
            "Customer: Thanks for the information.",
            "Pharmacist: You're welcome. Have a good day!",
        ]
        message = f"❌ {medicine_name} is currently out of stock at {pharmacy_name}. Expected restock in 2-3 days."
    
    return {
        "success": True,
        "simulated": True,
        "pharmacy_id": pharmacy_id,
        "pharmacy_name": pharmacy_name,
        "medicine": medicine_name,
        "available": available,
        "quantity": quantity,
        "price": price,
        "reserved": available,
        "quantity_reserved": quantity_needed if available else 0,
        "transcript": transcript,
        "message": message,
        "note": "⚠️ This is a SIMULATED call for demonstration purposes. No real call was made.",
    }


def get_medicine_tools():
    """Get all tools for the medicine finder agent."""
    return [
        search_pharmacies,
        check_availability,
        call_pharmacy,
    ]
