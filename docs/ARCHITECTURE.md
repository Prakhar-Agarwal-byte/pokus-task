# Pokus AI - Architecture Documentation

## Overview

This document provides a comprehensive architectural overview of the Pokus AI multi-agent system, designed for real-world task completion. The system goes beyond traditional AI assistants by driving tasks to **clear completion** rather than stopping at suggestions.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Details](#component-details)
3. [Data Flow](#data-flow)
4. [Agent Architecture](#agent-architecture)
5. [State Management](#state-management)
6. [API Design](#api-design)
7. [Deployment Architecture](#deployment-architecture)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Next.js Frontend (React)                          │    │
│  │                                                                          │    │
│  │    ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐     │    │
│  │    │  Landing     │    │   Medicine   │    │       Travel         │     │    │
│  │    │    Page      │    │   Task UI    │    │      Task UI         │     │    │
│  │    └──────────────┘    └──────────────┘    └──────────────────────┘     │    │
│  │                               │                         │                │    │
│  │                    ┌──────────┴─────────────────────────┴───────────┐   │    │
│  │                    │              CopilotKit React SDK               │   │    │
│  │                    │   • useCopilotReadable (share state)            │   │    │
│  │                    │   • useRenderToolCall (generative UI)           │   │    │
│  │                    │   • CopilotChat (chat interface)                │   │    │
│  │                    └────────────────────────┬───────────────────────┘   │    │
│  └─────────────────────────────────────────────┼───────────────────────────┘    │
└────────────────────────────────────────────────┼────────────────────────────────┘
                                                 │
                                      HTTP/WebSocket (AG-UI Protocol)
                                                 │
┌────────────────────────────────────────────────┼────────────────────────────────┐
│                                   SERVER LAYER                                  │
│  ┌─────────────────────────────────────────────┼───────────────────────────┐    │
│  │                        FastAPI Application                               │    │
│  │    ┌────────────────────────────────────────┴─────────────────────────┐ │    │
│  │    │                  CopilotKit Runtime Endpoint                      │ │    │
│  │    └────────────────────────────────────────┬─────────────────────────┘ │    │
│  │                                             │                            │    │
│  │    ┌────────────────────────────────────────┴─────────────────────────┐ │    │
│  │    │                    LangGraph Agent System                         │ │    │
│  │    │                                                                   │ │    │
│  │    │         ┌─────────────────────────────────────────┐               │ │    │
│  │    │         │           SUPERVISOR AGENT               │               │ │    │
│  │    │         │         (Intelligent Router)             │               │ │    │
│  │    │         └─────────────┬───────────────┬───────────┘               │ │    │
│  │    │                       │               │                            │ │    │
│  │    │         ┌─────────────▼─┐       ┌─────▼───────────┐               │ │    │
│  │    │         │   MEDICINE    │       │     TRAVEL      │               │ │    │
│  │    │         │    AGENT      │       │     AGENT       │               │ │    │
│  │    │         │  (Own LLM)    │       │   (Own LLM)     │               │ │    │
│  │    │         └───────────────┘       └─────────────────┘               │ │    │
│  │    └───────────────────────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               EXTERNAL SERVICES                                 │
│    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐    │
│    │   OpenAI API     │    │   Tavily API     │    │   Future APIs...     │    │
│    │   (LLM Provider) │    │  (Web Search)    │    │                      │    │
│    └──────────────────┘    └──────────────────┘    └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Frontend Components

#### Core Application Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Landing page (task selection)
│   ├── api/copilotkit/route.ts  # API route for CopilotKit
│   ├── chat/page.tsx            # General chat interface
│   └── tasks/
│       ├── medicine/page.tsx    # Medicine finder task
│       └── travel/page.tsx      # Travel planner task
│
├── components/
│   ├── providers/
│   │   └── CopilotKitProvider.tsx  # CopilotKit context provider
│   ├── tasks/
│   │   ├── medicine/
│   │   │   ├── PharmacyCard.tsx      # Pharmacy display component
│   │   │   ├── CallSimulation.tsx     # Call transcript UI
│   │   │   └── MedicineSearchStatus.tsx
│   │   └── travel/
│   │       ├── ItineraryDay.tsx       # Day plan display
│   │       ├── PreferencesCard.tsx    # Preferences summary
│   │       └── TravelSearchStatus.tsx
│   └── ui/                       # Shared UI components (shadcn/ui)
│
└── lib/
    ├── hooks.ts                  # Custom React hooks
    └── utils.ts                  # Utility functions
```

#### Key Frontend Patterns

| Pattern | Implementation | Purpose |
|---------|---------------|---------|
| **Generative UI** | `useRenderToolCall` | Render custom UI for agent tool calls |
| **State Sharing** | `useCopilotReadable` | Share frontend state with agents |
| **Persistence** | `usePersistedState` | localStorage for session continuity |
| **Progressive UI** | Stage-based rendering | Reveal information as task progresses |

### Backend Components

#### Agent System Structure

```
apps/agents/
├── src/
│   ├── main.py                  # FastAPI application entry
│   ├── task_registry.py         # Task registration system
│   ├── agents/
│   │   ├── supervisor.py        # Router agent (multi-agent coordinator)
│   │   ├── medicine.py          # Medicine finder agent + tools
│   │   └── travel.py            # Travel planner agent + tools
│   └── utils/
│       └── web_search.py        # Tavily API integration
│
├── requirements.txt             # Python dependencies
└── Dockerfile                   # Container definition
```

---

## Data Flow

### Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. USER INPUT                                                                  │
│     "Find me ibuprofen near downtown SF"                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. COPILOTKIT CHAT COMPONENT                                                   │
│     • Captures user message                                                     │
│     • Includes readable context (current state)                                 │
│     • Sends to backend via AG-UI protocol                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  3. SUPERVISOR AGENT                                                            │
│     • Analyzes user intent with LLM                                             │
│     • Routes decision: medicine_agent | travel_agent | respond_directly         │
│     • Passes conversation context to selected agent                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  4. MEDICINE AGENT (ReAct pattern)                                              │
│     • System prompt: Specialized for pharmacy tasks                             │
│     • Decides to call: search_pharmacies("ibuprofen", "downtown SF")            │
│     • Tool executes → returns results                                           │
│     • Generates natural language response                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  5. TOOL EXECUTION & UI RENDERING                                               │
│     • Tool call triggers useRenderToolCall on frontend                          │
│     • Custom UI component renders (MedicineSearchStatus)                        │
│     • Shows loading state → results                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  6. STATE UPDATE                                                                │
│     • Frontend state updated with pharmacies                                    │
│     • UI re-renders to show pharmacy cards                                      │
│     • Agent response displayed in chat                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### State Flow Diagram

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   FRONTEND  │                    │    AGENT    │                    │  EXTERNAL   │
│    STATE    │                    │   BACKEND   │                    │   SERVICES  │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │  useCopilotReadable              │                                  │
       ├─────────────────────────────────▶│                                  │
       │  (share current state)           │                                  │
       │                                  │                                  │
       │                                  │  Tavily API                      │
       │                                  ├─────────────────────────────────▶│
       │                                  │  (web search)                    │
       │                                  │                                  │
       │                                  │◀─────────────────────────────────┤
       │                                  │  (search results)                │
       │                                  │                                  │
       │  Tool call + result              │                                  │
       │◀─────────────────────────────────┤                                  │
       │  (triggers useRenderToolCall)    │                                  │
       │                                  │                                  │
       │  setState (update)               │                                  │
       ├─────────────────────────────────▶│                                  │
       │  (persist to localStorage)       │                                  │
       │                                  │                                  │
       ▼                                  ▼                                  ▼
```

---

## Agent Architecture

### Multi-Agent Coordination

The system uses a **Supervisor-Worker** pattern:

```
                              ┌────────────────────────────────┐
                              │       SUPERVISOR AGENT         │
                              │                                │
                              │  LLM: gpt-4o-mini (temp=0)     │
                              │  Purpose: Intelligent routing  │
                              │                                │
                              │  Input: User message + context │
                              │  Output: RouteDecision {       │
                              │    next_agent: string          │
                              │    reasoning: string           │
                              │    task_summary: string        │
                              │  }                             │
                              └────────────┬───────────────────┘
                                           │
                   ┌───────────────────────┼───────────────────────┐
                   │                       │                       │
                   ▼                       ▼                       ▼
    ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
    │    MEDICINE AGENT    │  │     TRAVEL AGENT     │  │  DIRECT RESPONSE     │
    │                      │  │                      │  │                      │
    │ LLM: gpt-4o-mini     │  │ LLM: gpt-4o-mini     │  │ (No agent needed)    │
    │ Temp: 0.7            │  │ Temp: 0.8            │  │ Greetings, meta Q's  │
    │                      │  │                      │  │                      │
    │ Tools:               │  │ Tools:               │  └──────────────────────┘
    │ • search_pharmacies  │  │ • update_preferences │
    │ • check_availability │  │ • generate_itinerary │
    │ • call_pharmacy      │  │ • modify_itinerary   │
    │                      │  │ • search_activities  │
    └──────────────────────┘  └──────────────────────┘
```

### LangGraph State Machine

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────┐
                            │   supervisor    │
                            │     node        │
                            └────────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
           (medicine_agent)   (travel_agent)   (respond_directly)
                    │                │                │
                    ▼                ▼                │
           ┌───────────────┐ ┌───────────────┐       │
           │ medicine_node │ │  travel_node  │       │
           │               │ │               │       │
           │  ReAct Loop:  │ │  ReAct Loop:  │       │
           │  LLM → Tool   │ │  LLM → Tool   │       │
           │  → LLM → ...  │ │  → LLM → ...  │       │
           └───────┬───────┘ └───────┬───────┘       │
                   │                 │                │
                   └────────────────┬┘                │
                                    │                 │
                                    ▼                 │
                                   END ◀──────────────┘
```

---

## State Management

### Frontend State Structure

```typescript
// Medicine Task State
interface MedicineState {
  stage: 'idle' | 'searching' | 'found_pharmacies' | 
         'checking_availability' | 'calling' | 'completed';
  medicine: string;
  location: string;
  pharmacies: Pharmacy[];
  selectedPharmacy: Pharmacy | null;
  callResult: CallResult | null;
}

// Travel Task State
interface TravelState {
  stage: 'idle' | 'gathering' | 'planning' | 'refining' | 'completed';
  preferences: {
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
    budget: 'budget' | 'moderate' | 'luxury' | null;
    interests: string[];
    pace: 'relaxed' | 'moderate' | 'packed' | null;
    travelers: number | null;
  };
  itinerary: DayPlan[];
  totalCost: number;
}
```

### Backend Agent State

```python
class AgentState(CopilotKitState):
    """State shared across all agents in the multi-agent system."""
    
    # From CopilotKitState
    messages: list[BaseMessage]  # Conversation history
    
    # Routing fields
    next_agent: str = ""         # Which agent to route to
    task_type: str = ""          # "medicine", "travel", or "general"
    agent_outputs: dict = {}     # Outputs from each agent
    iteration: int = 0           # Track routing iterations
```

---

## API Design

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | POST | AG-UI protocol endpoint (CopilotKit runtime) |
| `/health` | GET | Health check for container orchestration |
| `/tasks` | GET | List available tasks for frontend discovery |
| `/test-graph` | POST | Debug endpoint to test agent directly |

### Health Check Response

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime_seconds": 1234.56,
  "tasks_registered": 2,
  "tasks_enabled": 2,
  "llm_provider": "openai",
  "web_search": "tavily"
}
```

---

## Deployment Architecture

### Docker Compose Setup

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Docker Compose                                     │
│                                                                                 │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────┐     │
│  │          web (Next.js)          │   │        agents (FastAPI)         │     │
│  │                                 │   │                                 │     │
│  │  Port: 3000                     │   │  Port: 8000                     │     │
│  │  Depends on: agents             │   │  Health: /health                │     │
│  │                                 │   │                                 │     │
│  │  Environment:                   │   │  Environment:                   │     │
│  │  - REMOTE_ACTION_URL            │   │  - OPENAI_API_KEY               │     │
│  │  - OPENAI_API_KEY               │   │  - TAVILY_API_KEY               │     │
│  └─────────────────────────────────┘   └─────────────────────────────────┘     │
│              │                                        ▲                        │
│              │          HTTP (internal network)       │                        │
│              └────────────────────────────────────────┘                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │                   │
                    Port 3000 │                   │ Port 8000
                              ▼                   ▼
                         Host Machine (localhost)
```

### Production Deployment Options

```
                    ┌─────────────────────────────────────────┐
                    │              User Browser               │
                    └─────────────────────┬───────────────────┘
                                          │
                    ┌─────────────────────▼───────────────────┐
                    │                CDN / Edge               │
                    │            (Vercel Edge Network)        │
                    └─────────────────────┬───────────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               │
┌─────────────────────┐      ┌─────────────────────┐                     │
│   Vercel (Frontend) │      │  Railway/Fly.io    │                     │
│                     │      │    (Backend)        │                     │
│   Next.js SSR       │◀─────│                     │                     │
│   Static Assets     │      │   FastAPI Server    │                     │
│   API Routes        │      │   LangGraph Agents  │                     │
└─────────────────────┘      └──────────┬──────────┘                     │
                                        │                                 │
                    ┌───────────────────┼───────────────────┐            │
                    │                   │                   │            │
                    ▼                   ▼                   ▼            │
             ┌────────────┐     ┌────────────┐      ┌────────────┐       │
             │  OpenAI    │     │   Tavily   │      │   Future   │       │
             │    API     │     │    API     │      │    APIs    │       │
             └────────────┘     └────────────┘      └────────────┘       │
```

---

## Key Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **True Multi-Agent** | Specialized prompts per domain | Slightly more complex routing |
| **Frontend State** | Fast updates, persistence via localStorage | No server-side backup |
| **Supervisor Pattern** | Clean separation of routing vs execution | Extra LLM call for routing |
| **Simulated End-Mile** | Full demo without real integrations | Not production-ready for calls |
| **Task Registry** | Easy to add new task types | Upfront structure required |
| **CopilotKit** | Rich generative UI out of the box | Vendor dependency |

---

## Future Extensibility

The architecture is designed to scale:

1. **Add New Tasks**: Create agent file → Register in task_registry → Add frontend page
2. **Add New LLM Providers**: Update `get_llm()` function with fallback chain
3. **Add Real Integrations**: Replace simulated tools with actual API calls
4. **Add Authentication**: Integrate with auth provider at CopilotKit provider level
5. **Add Persistence**: Replace localStorage with database-backed state
