"""
Web Search Utilities - Real web search integration using Tavily API.

This module provides real web search capabilities for both medicine and travel agents.
Uses Tavily's `include_answer=True` feature to get AI-synthesized content that 
includes real place names, prices, and recommendations.

Key Functions:
- search_pharmacies_web: Find pharmacies near a location with medicine availability
- search_destination_info: Get travel destination info with attractions and costs
- search_activities_web: Find specific activities at a destination

Configuration:
- Set TAVILY_API_KEY in .env file
- Free tier: 1000 searches/month at https://tavily.com/

Falls back to simulated results if API key is not available.
"""

import os
import json
import logging
from typing import Optional
from tavily import TavilyClient

logger = logging.getLogger(__name__)


def get_tavily_client() -> Optional[TavilyClient]:
    """Get Tavily client if API key is available."""
    api_key = os.getenv("TAVILY_API_KEY")
    if api_key and api_key != "your_tavily_api_key":
        logger.debug("Tavily client initialized")
        return TavilyClient(api_key=api_key)
    logger.warning("Tavily API key not configured")
    return None


def search_pharmacies_web(
    medicine_name: str,
    location: str,
    radius_km: float = 5.0,
) -> dict:
    """
    Search for real pharmacies using web search.
    Uses include_answer=True to get AI-synthesized content with real pharmacy info.
    Returns the answer and sources for internal LLM to structure.
    """
    logger.debug(f"[TAVILY] Pharmacy search: {medicine_name} near {location}")
    client = get_tavily_client()
    
    if not client:
        logger.error("[TAVILY] No client available")
        return {"success": False, "error": "Tavily API key not configured", "use_fallback": True}
    
    try:
        # Search for pharmacies with medicine - include pricing and contact info
        query = f"pharmacies near {location} that have {medicine_name} in stock. Include pharmacy names, addresses, phone numbers, hours of operation, and prices."
        logger.debug(f"[TAVILY] Query: {query}")
        
        results = client.search(
            query=query,
            search_depth="advanced",
            max_results=10,
            include_answer=True,
        )
        
        # Get the AI-generated answer
        answer = results.get("answer") or ""
        logger.debug(f"[TAVILY] Got answer: {len(answer)} chars")
        logger.debug(f"[TAVILY] Got {len(results.get('results', []))} source results")
        
        # Collect source snippets for additional context
        sources = []
        content_snippets = []
        
        for result in results.get("results", [])[:8]:
            title = result.get("title", "")
            content = result.get("content", "")
            sources.append({
                "title": title,
                "snippet": content[:400],
                "url": result.get("url", ""),
            })
            if content:
                content_snippets.append(f"- {content[:500]}")
        
        # If no AI answer, build one from snippets
        if not answer and content_snippets:
            answer = f"Pharmacies near {location} for {medicine_name}:\n" + "\n".join(content_snippets[:6])
            logger.debug(f"[TAVILY] Built fallback answer from snippets: {len(answer)} chars")
        
        if not answer:
            return {"success": False, "error": "No pharmacy information found", "use_fallback": True}
        
        return {
            "success": True,
            "medicine_name": medicine_name,
            "location": location,
            "answer": answer,  # AI-synthesized pharmacy info with real names
            "sources": sources,  # Raw snippets for additional context
            "search_query": query,
        }
        
    except Exception as e:
        logger.error(f"[TAVILY] Pharmacy search error: {e}")
        return {"success": False, "error": str(e), "use_fallback": True}


def search_destination_info(
    destination: str,
    interests: list[str] = None,
) -> dict:
    """
    Search for real destination information using web search.
    Uses include_answer=True to get AI-synthesized content with real place names.
    Also extracts pricing information when mentioned in search results.
    """
    logger.debug(f"[TAVILY] Destination search: {destination}")
    client = get_tavily_client()
    
    if not client:
        logger.error("[TAVILY] No client available")
        return {"success": False, "error": "Tavily API key not configured", "use_fallback": True}
    
    interests_str = ", ".join(interests) if interests else "sightseeing, food, culture"
    logger.debug(f"[TAVILY] Interests: {interests_str}")
    
    try:
        # Build query dynamically based on interests
        query = f"best {interests_str} in {destination} with prices and costs. Top places to visit, things to do, where to eat. Include entry fees, ticket prices, meal costs in USD."
        logger.debug(f"[TAVILY] Query: {query}")
        
        results = client.search(
            query=query,
            search_depth="advanced",
            max_results=10,
            include_answer=True,
        )
        
        # Get the AI-generated answer (may be None if not available)
        answer = results.get("answer") or ""
        logger.debug(f"[TAVILY] Got answer: {len(answer)} chars")
        logger.debug(f"[TAVILY] Got {len(results.get('results', []))} source results")
        
        # Collect source snippets
        sources = []
        content_snippets = []
        
        for result in results.get("results", [])[:8]:
            title = result.get("title", "")
            content = result.get("content", "")
            sources.append({
                "title": title,
                "snippet": content[:400],  # Include more content for price context
                "url": result.get("url", ""),
            })
            if content:
                content_snippets.append(f"- {content[:500]}")
        
        # If no AI answer, build one from snippets
        if not answer and content_snippets:
            answer = f"Here are top places and activities in {destination}:\n" + "\n".join(content_snippets[:6])
            logger.debug(f"[TAVILY] Built fallback answer from snippets: {len(answer)} chars")
        
        if not answer:
            return {"success": False, "error": "No destination information found", "use_fallback": True}
        
        return {
            "success": True,
            "destination": destination,
            "answer": answer,  # Contains place names and prices mentioned in search
            "sources": sources,  # Raw snippets with pricing info for LLM to extract
            "search_query": query,
        }
        
    except Exception as e:
        logger.error(f"[TAVILY] Destination search error: {e}")
        return {"success": False, "error": str(e), "use_fallback": True}


def search_activities_web(
    destination: str,
    activity_type: str,
    budget: str = "moderate",
) -> dict:
    """
    Search for specific activities at a destination.
    Uses include_answer=True for AI-synthesized recommendations.
    """
    logger.debug(f"[TAVILY] Activity search: {activity_type} in {destination} ({budget})")
    client = get_tavily_client()
    
    if not client:
        logger.error("[TAVILY] No client available")
        return {"success": False, "error": "Tavily API key not configured", "use_fallback": True}
    
    budget_terms = {
        "budget": "cheap affordable budget-friendly",
        "moderate": "mid-range popular recommended",
        "luxury": "luxury premium high-end exclusive",
    }
    
    try:
        query = f"top 5 {activity_type} places in {destination} {budget_terms.get(budget, '')} with specific names and addresses"
        logger.debug(f"[TAVILY] Query: {query}")
        
        results = client.search(
            query=query,
            search_depth="advanced",
            max_results=8,
            include_answer=True,  # Get AI-synthesized answer
            # Note: Removed include_domains to get broader results
        )
        
        # Handle None answer
        answer = results.get("answer") or ""
        logger.debug(f"[TAVILY] Got answer: {len(answer)} chars")
        
        # Collect sources and build fallback if needed
        sources = []
        content_snippets = []
        for result in results.get("results", [])[:5]:
            content = result.get("content", "")
            sources.append({
                "title": result.get("title", ""),
                "url": result.get("url", ""),
            })
            if content:
                content_snippets.append(f"- {content[:300]}")
        
        # If no AI answer, build from snippets
        if not answer and content_snippets:
            answer = f"Top {activity_type} in {destination}:\n" + "\n".join(content_snippets[:5])
            logger.debug(f"[TAVILY] Built fallback answer: {len(answer)} chars")
        
        return {
            "success": True,
            "destination": destination,
            "activity_type": activity_type,
            "answer": answer,  # AI-synthesized recommendations
            "sources": sources,
        }
        
    except Exception as e:
        logger.error(f"[TAVILY] Activity search error: {e}")
        return {"success": False, "error": str(e), "use_fallback": True}


def search_medicine_availability(
    pharmacy_name: str,
    medicine_name: str,
    location: str,
) -> dict:
    """
    Search for medicine availability information.
    """
    client = get_tavily_client()
    
    if not client:
        return {"success": False, "error": "Tavily API key not configured", "use_fallback": True}
    
    try:
        query = f"{pharmacy_name} {location} {medicine_name} availability stock price"
        
        results = client.search(
            query=query,
            search_depth="basic",
            max_results=5,
        )
        
        # Extract pricing info if found
        content = " ".join([r.get("content", "") for r in results.get("results", [])])
        
        return {
            "success": True,
            "pharmacy_name": pharmacy_name,
            "medicine_name": medicine_name,
            "search_content": content[:500],
            "sources": [r.get("url") for r in results.get("results", [])][:3],
        }
        
    except Exception as e:
        return {"success": False, "error": str(e), "use_fallback": True}


def extract_phone(text: str) -> str:
    """Extract phone number from text."""
    import re
    # Match common US phone patterns
    patterns = [
        r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        r'\d{3}[-.\s]\d{3}[-.\s]\d{4}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group()
    return "Contact via website"


def extract_address(text: str, location: str) -> str:
    """Extract address from text or return location-based placeholder."""
    import re
    # Try to find address patterns
    patterns = [
        r'\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group()
    return f"Near {location} (see website for exact address)"
