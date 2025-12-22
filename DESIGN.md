# Pokus AI - Multi-Agent System for Real-World Task Completion

## Design Document

### Executive Summary

This document describes the architecture and design of a multi-agent AI system that can complete real-world tasks end-to-end. Unlike traditional AI assistants that stop at suggestions, this system drives tasks to **clear completion** using agent-based reasoning and generative UI.

The system supports two primary use cases:
1. **Medicine Finder** - Locate medicines at nearby pharmacies with availability checking and simulated calls
2. **Travel Planner** - Create detailed, multi-day travel itineraries with iterative refinement

---

## 📚 Additional Documentation

For detailed information, see:

| Document | Description |
|----------|-------------|
| [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) | Detailed component architecture, data flow, API design |
| [**docs/DIAGRAMS.md**](docs/DIAGRAMS.md) | Visual diagrams and sequence flows |
| [**docs/ASSUMPTIONS_AND_TRADEOFFS.md**](docs/ASSUMPTIONS_AND_TRADEOFFS.md) | Design decisions, trade-offs, and rationale |

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Multi-Agent Design](#multi-agent-design)
3. [Generative UI Flow](#generative-ui-flow)
4. [Simulated End-Mile Execution](#simulated-end-mile-execution)
5. [Scalability Design](#scalability-design)
6. [Technology Stack](#technology-stack)
7. [Trade-offs & Assumptions](#trade-offs--assumptions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Landing Page  │  │  Medicine Task  │  │      Travel Task            │  │
│  │                 │  │                 │  │                             │  │
│  │  Task Selection │  │ • PharmacyCard  │  │ • ItineraryDay              │  │
│  │                 │  │ • CallSimulation│  │ • PreferencesCard           │  │
│  │                 │  │ • SearchStatus  │  │ • TravelSearchStatus        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│                                    │                                        │
│                        ┌───────────┴───────────┐                            │
│                        │    CopilotKit Chat    │                            │
│                        │  • useCopilotAction   │                            │
│                        │  • useCopilotReadable │                            │
│                        │  • Generative UI      │                            │
│                        └───────────┬───────────┘                            │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ HTTP/WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI + LangGraph)                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      CopilotKit Runtime Endpoint                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SUPERVISOR AGENT                            │    │
│  │                           (Router LLM)                              │    │
│  │                                                                     │    │
│  │  • Analyzes user intent with dedicated LLM                          │    │
│  │  • Routes to specialized agents (not just tools)                    │    │
│  │  • Each agent has its OWN LLM instance                              │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                          │
│              ┌───────────────────┴───────────────────┐                      │
│              ▼                                       ▼                      │
│  ┌─────────────────────────────┐     ┌─────────────────────────────┐        │
│  │      MEDICINE AGENT         │     │       TRAVEL AGENT          │        │
│  │       (Own LLM)             │     │        (Own LLM)            │        │
│  │                             │     │                             │        │
│  │  Tools:                     │     │  Tools:                     │        │
│  │  • search_pharmacies        │     │  • update_preferences       │        │
│  │  • check_availability       │     │  • generate_itinerary       │        │
│  │  • call_pharmacy            │     │  • modify_itinerary         │        │
│  │                             │     │  • search_activities        │        │
│  └─────────────────────────────┘     └─────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Single ReAct Agent with Multiple Tools** - Rather than complex multi-agent routing, we use a single powerful supervisor agent that has access to all tools. This simplifies the architecture while maintaining flexibility.

2. **Frontend-First Generative UI** - Using CopilotKit's `useCopilotAction` with render functions, the UI components are defined in the frontend but triggered by agent tool calls. This provides rich, interactive UI without complex state synchronization.

3. **Simulated External Services** - All external API calls (pharmacy search, availability, calls) are simulated with realistic data. This allows for complete demonstration without requiring API keys.

4. **Stateless Backend + Stateful Frontend** - The backend agents are stateless (each request is independent), while the frontend maintains task state. This enables easy scaling and deployment.

---

## Multi-Agent Design

### True Multi-Agent Architecture

This system implements a **true multi-agent architecture** where each agent has its own LLM instance and specialized capabilities:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SUPERVISOR AGENT                                 │
│                              (Router LLM)                                   │
│                                                                             │
│  Role: Intelligent router that decides which specialized agent to invoke   │
│                                                                             │
│  Responsibilities:                                                          │
│  • Analyze user intent using its own LLM instance                           │
│  • Make structured routing decisions (medicine_agent | travel_agent)        │
│  • Pass context to the selected specialized agent                           │
│  • Handle general queries directly (greetings, meta questions)              │
│                                                                             │
│  Implementation: LangGraph StateGraph with structured output                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┴─────────────────────────────┐
        ▼                                                           ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│       MEDICINE AGENT          │               │        TRAVEL AGENT           │
│         (Own LLM)             │               │         (Own LLM)             │
│                               │               │                               │
│ System Prompt: Specialized    │               │ System Prompt: Specialized    │
│ for pharmacy/medicine tasks   │               │ for travel planning tasks     │
│                               │               │                               │
│ Tools:                        │               │ Tools:                        │
│ ┌───────────────────────────┐ │               │ ┌───────────────────────────┐ │
│ │ search_pharmacies         │ │               │ │ update_preferences        │ │
│ │ • Input: medicine, loc    │ │               │ │ • Stores user prefs       │ │
│ │ • Output: nearby stores   │ │               │ │ • Incremental updates     │ │
│ │                           │ │               │ │                           │ │
│ │ check_availability        │ │               │ │ generate_itinerary        │ │
│ │ • Input: pharmacy, med    │ │               │ │ • Creates multi-day plan  │ │
│ │ • Output: stock & price   │ │               │ │ • Uses preferences        │ │
│ │                           │ │               │ │                           │ │
│ │ call_pharmacy             │ │               │ │ modify_itinerary          │ │
│ │ • Input: pharmacy, qty    │ │               │ │ • Add/remove/replace      │ │
│ │ • Output: call transcript │ │               │ │                           │ │
│ └───────────────────────────┘ │               │ │ search_activities         │ │
│                               │               │ │ • Find activity types     │ │
│                               │               │ └───────────────────────────┘ │
└───────────────────────────────┘               └───────────────────────────────┘
```

### Agent Coordination Pattern

We use a **Supervisor-Worker** pattern with LangGraph StateGraph:

```python
# Multi-agent system with separate LLM instances
class AgentState(TypedDict):
    messages: list[BaseMessage]
    next_agent: str              # Routing decision
    task_type: str               # "medicine" | "travel" | "general"
    agent_outputs: dict          # Track which agents ran

def create_supervisor_graph():
    builder = StateGraph(AgentState)
    
    # Each node is a separate agent with its own LLM
    builder.add_node("supervisor", supervisor_node)      # Router LLM
    builder.add_node("medicine_agent", medicine_node)    # Medicine LLM + tools
    builder.add_node("travel_agent", travel_node)        # Travel LLM + tools
    
    # Supervisor routes to specialized agents
    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges("supervisor", route_to_agent)
    builder.add_edge("medicine_agent", END)
    builder.add_edge("travel_agent", END)
    
    return builder.compile()
```

### Why True Multi-Agent?

| Aspect | Single Agent | True Multi-Agent (Chosen) |
|--------|--------------|---------------------------|
| LLM Instances | 1 shared | 3 separate (supervisor + 2 workers) |
| Specialization | Tools only | Full agent per domain |
| System Prompts | Generic | Domain-specific optimization |
| Scalability | Add tools | Add entire agents |
| Failure Isolation | All or nothing | Agent-level isolation |
| Temperature | Same for all | Tuned per task (routing=0, travel=0.8) |

### State Management

```typescript
// Frontend state (React useState)
interface MedicineState {
  stage: 'idle' | 'searching' | 'found_pharmacies' | 'checking' | 'calling' | 'completed';
  medicine: string;
  location: string;
  pharmacies: Pharmacy[];
  selectedPharmacy: Pharmacy | null;
  callResult: CallResult | null;
}

interface TravelState {
  stage: 'idle' | 'gathering' | 'planning' | 'refining' | 'completed';
  preferences: TravelPreferences;
  itinerary: DayPlan[];
  totalCost: number;
}
```

State is managed in the frontend and made available to agents via `useCopilotReadable`:

```typescript
useCopilotReadable({
  description: 'Current task state',
  value: state,
});
```

---

## Generative UI Flow

### Component Rendering Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GENERATIVE UI PATTERN                             │
└─────────────────────────────────────────────────────────────────────────────┘

  User: "Find paracetamol near downtown SF"
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Agent decides to call: search_pharmacies(medicine, location)           │
  └─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  CopilotKit triggers useCopilotAction render function                   │
  │                                                                         │
  │  useCopilotAction({                                                     │
  │    name: 'searchPharmacies',                                            │
  │    render: ({ status, args }) => (                                      │
  │      <MedicineSearchStatus                                              │
  │        status={status}                                                  │
  │        medicine={args.medicine}                                         │
  │        location={args.location}                                         │
  │      />                                                                 │
  │    ),                                                                   │
  │  });                                                                    │
  └─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  RENDERED IN CHAT:                                                      │
  │  ┌───────────────────────────────────────────────────────────────────┐  │
  │  │  🔍 Searching for pharmacies...                                   │  │
  │  │  ┌──────────┐ ┌──────────────┐                                    │  │
  │  │  │paracetamol│ │downtown SF  │                                    │  │
  │  │  └──────────┘ └──────────────┘                                    │  │
  │  │  ████████████████░░░░░░░░░░░░░░  Loading...                       │  │
  │  └───────────────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  STATE UPDATE: Pharmacies added to state, UI re-renders                 │
  │                                                                         │
  │  Left Panel shows:                                                      │
  │  ┌───────────────────────────────────────────────────────────────────┐  │
  │  │  Nearby Pharmacies                                                │  │
  │  │  ┌─────────────────────────────────────────────────────────────┐  │  │
  │  │  │ CVS Pharmacy           ★ 4.2   Open Now                     │  │  │
  │  │  │ 123 Main St, SF        0.5 km   (555) 123-4567              │  │  │
  │  │  │ [Stock not checked]                                         │  │  │
  │  │  └─────────────────────────────────────────────────────────────┘  │  │
  │  │  ┌─────────────────────────────────────────────────────────────┐  │  │
  │  │  │ Walgreens              ★ 4.0   24 Hours                     │  │  │
  │  │  │ 456 Oak Ave, SF        0.8 km   (555) 234-5678              │  │  │
  │  │  │ [Stock not checked]                                         │  │  │
  │  │  └─────────────────────────────────────────────────────────────┘  │  │
  │  └───────────────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────────────────┘
```

### Progressive Disclosure

The UI reveals information progressively as the task advances:

```
Stage 1: IDLE
├── Show: Empty state with instructions

Stage 2: SEARCHING
├── Show: Search progress indicator
└── Show: Medicine and location badges

Stage 3: FOUND_PHARMACIES
├── Show: All previous
└── Show: Pharmacy list cards

Stage 4: CALLING
├── Show: All previous
├── Show: Selected pharmacy highlighted
└── Show: Call simulation with transcript

Stage 5: COMPLETED
├── Show: All previous
└── Show: Final result card (success/failure)
```

### Key UI Components

| Component | Purpose | Trigger |
|-----------|---------|---------|
| `MedicineSearchStatus` | Shows search progress | `searchPharmacies` tool |
| `PharmacyCard` | Displays pharmacy info | State update |
| `CallSimulation` | Shows call transcript | `callPharmacy` tool |
| `PreferencesCard` | Shows gathered prefs | `updatePreferences` tool |
| `ItineraryDay` | Displays day activities | `display_itinerary` action |
| `TravelSearchStatus` | Shows planning progress | `generateItinerary` tool |

### Frontend Actions vs Backend Tools

The system uses both **backend tools** (run on the server) and **frontend actions** (run in the browser):

| Type | Location | Use Case |
|------|----------|----------|
| **Backend Tool** | Python/LangGraph | API calls, web search, data processing |
| **Frontend Action** | React/CopilotKit | UI updates, state management, user interactions |

**Example: Travel Itinerary Flow**

```
1. User: "Plan a trip to Bali"
         │
         ▼
2. LLM calls: generate_itinerary (BACKEND TOOL)
   - Tavily web search for real attractions, restaurants
   - Returns research data with real place names
         │
         ▼
3. LLM synthesizes research into structured days/activities
         │
         ▼
4. LLM calls: display_itinerary (FRONTEND ACTION)
   - Receives structured itinerary from LLM
   - Updates left pane state with itinerary cards
   - Shows visual ItineraryDay components
```

This separation allows the LLM to create high-quality structured output from raw research data.

---

## Simulated End-Mile Execution

### Philosophy

For actions that would normally require real-world execution (calling a pharmacy, making a reservation), we generate **simulated but realistic results**. These are:

1. **Clearly labeled** as simulated
2. **Realistic in format** (real transcripts, real data structures)
3. **Useful for demonstration** (show the full workflow)

### Pharmacy Call Simulation

```python
@tool
def call_pharmacy(pharmacy_id, pharmacy_name, medicine_name, quantity_needed=1):
    """
    Simulate calling a pharmacy to confirm availability and reserve medicine.
    
    This is a SIMULATED call for demonstration purposes. No real calls are made.
    """
    # Simulate call outcome (80% success rate)
    available = random.random() > 0.2
    
    # Generate realistic transcript
    transcript = [
        f"Pharmacist: Thank you for calling {pharmacy_name}...",
        f"Customer: Hi, I'm looking for {medicine_name}...",
        # ... realistic conversation flow
    ]
    
    return {
        "success": True,
        "simulated": True,  # Always marked as simulated
        "available": available,
        "transcript": transcript,
        "note": "⚠️ This is a SIMULATED call for demonstration purposes.",
    }
```

### Visual Indication

```tsx
// Call result card with clear simulation warning
<Card className={available ? 'border-emerald-200' : 'border-amber-200'}>
  <CardHeader>
    <Badge variant="warning">⚠️ Simulated Call - Not Real</Badge>
    <CardTitle>
      {available ? 'Medicine Reserved!' : 'Not Available'}
    </CardTitle>
  </CardHeader>
  {/* ... result details ... */}
</Card>
```

---

## Scalability Design

### Task Registry Pattern

The system is designed to easily accommodate new task types:

```typescript
// Task Registry (conceptual)
interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  uiComponents: Record<string, React.ComponentType>;
  systemPrompt: string;
}

// Adding a new task type
const groceryPickupTask: TaskDefinition = {
  id: 'grocery_pickup',
  name: 'Grocery Pickup',
  description: 'Order groceries for pickup or delivery',
  tools: [
    searchGroceryStores,
    createShoppingList,
    checkAvailability,
    schedulePickup,
  ],
  uiComponents: {
    StoreCard,
    ShoppingList,
    PickupScheduler,
  },
  systemPrompt: GROCERY_SYSTEM_PROMPT,
};

// Register the task
taskRegistry.register(groceryPickupTask);
```

### Adding New Tasks: Step-by-Step

1. **Define Tools** (Python backend)
   ```python
   @tool
   def search_grocery_stores(location: str, radius_km: float = 5.0) -> list:
       """Search for grocery stores near a location."""
       # Implementation
   ```

2. **Create UI Components** (React frontend)
   ```tsx
   function StoreCard({ store }: { store: GroceryStore }) {
     return (
       <Card>
         {/* Store details */}
       </Card>
     );
   }
   ```

3. **Register CopilotKit Actions**
   ```tsx
   useCopilotAction({
     name: 'searchGroceryStores',
     handler: async (args) => { /* ... */ },
     render: ({ status, args }) => <SearchStatus {...args} />,
   });
   ```

4. **Create Task Page**
   ```tsx
   // app/tasks/grocery/page.tsx
   export default function GroceryPage() {
     // Task-specific UI and state
   }
   ```

### Shared Capabilities

Common functionality is extracted for reuse:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHARED CAPABILITIES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Location Services                                                          │
│  • Get user location                                                        │
│  • Search nearby places                                                     │
│  • Calculate distances                                                      │
│                                                                             │
│  Communication                                                              │
│  • Simulated calls                                                          │
│  • Simulated messages                                                       │
│  • Email composition                                                        │
│                                                                             │
│  Search & Discovery                                                         │
│  • Web search (Tavily)                                                      │
│  • Place details                                                            │
│  • Reviews and ratings                                                      │
│                                                                             │
│  Reservation & Booking                                                      │
│  • Time slot selection                                                      │
│  • Confirmation flow                                                        │
│  • Cancellation handling                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Future Task Examples

| Task | Tools Required | Shared Capabilities |
|------|---------------|---------------------|
| Book a Plumber | `searchPlumbers`, `checkAvailability`, `scheduleAppointment` | Location, Communication, Booking |
| Grocery Pickup | `searchStores`, `buildList`, `checkStock`, `schedulePickup` | Location, Search, Booking |
| Weekend Trip | `searchDestinations`, `findAccommodation`, `planActivities` | Search, Travel tools, Booking |
| Restaurant Reservation | `searchRestaurants`, `checkTables`, `makeReservation` | Location, Search, Booking |

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.0 | React framework with App Router |
| **TypeScript** | 5.x | Type safety |
| **CopilotKit** | 1.50.1 | AI chat + generative UI |
| **Tailwind CSS** | 3.4.1 | Styling |
| **Radix UI** | Latest | Accessible components |
| **Framer Motion** | 11.x | Animations |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.115.14 | Python web framework |
| **LangGraph** | 0.2.76 | Agent orchestration |
| **LangChain** | 0.3.27 | LLM abstraction |
| **CopilotKit SDK** | 0.1.39 | Frontend integration |
| **Pydantic** | 2.11.7 | Data validation |
| **Tavily** | Latest | Web search API |

### LLM Providers (Priority Order)

| Provider | Model | Purpose |
|----------|-------|---------|
| **Google Gemini** | gemini-2.0-flash | Default (free tier) |
| **Anthropic** | claude-sonnet-4-20250514 | Alternative |
| **OpenAI** | gpt-4o | Alternative |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **docker-compose** | Local orchestration |
| **Vercel** | Frontend hosting (prod) |
| **Railway/Fly.io** | Backend hosting (prod) |

---

## Trade-offs & Assumptions

### Assumptions

1. **Simulated Data is Acceptable** - For demonstration purposes, all external data (pharmacies, availability, travel info) is simulated.

2. **Single User Session** - No multi-user state management or authentication is implemented.

3. **English Language** - The system is designed for English language interactions.

4. **Modern Browser** - The UI requires a modern browser with JavaScript enabled.

### Trade-offs

| Decision | Trade-off |
|----------|-----------|
| **True Multi-Agent** | More specialized but slightly more complex routing |
| **Frontend State + localStorage** | Persists across refresh but no server-side backup |
| **Tavily Web Search** | Real data but requires API key |
| **CopilotKit** | Great UX but vendor dependency |
| **Task Registry Pattern** | Extensible but requires upfront structure |

### What's Implemented

1. ✅ **True Multi-Agent** - Supervisor + Medicine + Travel agents with separate LLMs
2. ✅ **Web Search** - Tavily API for real pharmacy/activity data
3. ✅ **Generative UI** - All task actions render rich UI components
4. ✅ **Simulated End-Mile** - Realistic call transcripts (clearly labeled)
5. ✅ **Task Registry** - Scalable pattern for adding new tasks
6. ✅ **localStorage Persistence** - State survives page refresh
7. ✅ **Docker Deployment** - Containerized with docker-compose
8. ✅ **Health Endpoint** - `/health` route for monitoring

---

## Conclusion

This multi-agent system demonstrates how AI can move beyond simple Q&A to complete real-world tasks. By combining:

- **Intelligent agent orchestration** (LangGraph)
- **Rich generative UI** (CopilotKit)
- **Simulated end-mile execution**
- **Extensible task architecture**

We create a system that can help users accomplish complex tasks from start to finish, with a clear path to adding new capabilities.

The architecture prioritizes **simplicity** and **extensibility** over premature optimization, making it suitable for rapid iteration and future growth.
