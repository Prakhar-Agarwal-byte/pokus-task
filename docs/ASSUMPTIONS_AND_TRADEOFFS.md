# Pokus AI - Assumptions and Trade-offs

This document outlines the key assumptions made during the design and implementation of the Pokus AI multi-agent system, along with the trade-offs considered for each architectural decision.

---

## Table of Contents

1. [Core Assumptions](#core-assumptions)
2. [Architectural Trade-offs](#architectural-trade-offs)
3. [Technology Choices](#technology-choices)
4. [Implementation Trade-offs](#implementation-trade-offs)
5. [Future Considerations](#future-considerations)

---

## Core Assumptions

### 1. Demonstration Environment

| Assumption | Rationale | Impact |
|------------|-----------|--------|
| **Simulated external actions** | Real pharmacy calls/bookings would require partnerships, legal agreements | All end-mile actions (calls, reservations) are simulated with realistic data |
| **No authentication required** | Simplifies demo; auth is orthogonal to agent architecture | Single-user sessions, no user data persistence |
| **English language only** | Focused development on core agent capabilities | No i18n support; prompts and UI are in English |

### 2. User Behavior

| Assumption | Rationale | Impact |
|------------|-----------|--------|
| **Users have a clear task goal** | System is task-oriented, not general chat | Landing page directs users to specific task types |
| **Users are cooperative** | They provide requested information when asked | Agent prompts assume good-faith interaction |
| **Modern browser usage** | Target audience uses Chrome, Firefox, Safari, Edge | No legacy browser support; relies on modern JS features |

### 3. Technical Environment

| Assumption | Rationale | Impact |
|------------|-----------|--------|
| **Stable network connectivity** | Required for LLM API calls and web search | No offline mode; errors shown if connection drops |
| **API keys are available** | Demo requires OpenAI and Tavily keys | Setup requires obtaining free API keys |
| **Low latency tolerance** | Users expect responsive AI interactions | Optimized for speed over comprehensive reasoning |

---

## Architectural Trade-offs

### 1. Multi-Agent vs Single Agent

**Chosen: True Multi-Agent Architecture**

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           OPTION COMPARISON                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   Single Agent + Many Tools           Multi-Agent (CHOSEN)                 │
│   ────────────────────────            ──────────────────────               │
│                                                                            │
│   ✓ Simpler architecture              ✓ Domain-specific optimization       │
│   ✓ Fewer LLM calls                   ✓ Separate temperature settings      │
│   ✓ Easier debugging                  ✓ Independent scaling                │
│                                       ✓ Cleaner system prompts             │
│   ✗ Generic prompts                   ✓ Failure isolation                  │
│   ✗ Temperature compromise                                                 │
│   ✗ Tool overload (many tools)        ✗ Extra routing LLM call             │
│   ✗ No task specialization            ✗ More complex state management      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Why Multi-Agent:**
- Each domain (medicine, travel) benefits from specialized system prompts
- Temperature tuning: routing needs precision (temp=0), travel planning benefits from creativity (temp=0.8)
- Future scalability: adding new agents doesn't bloat existing ones
- Failure isolation: one agent's issues don't affect others

**Trade-off Cost:**
- Additional LLM call for routing decision (~100-300ms latency)
- More complex state management across agents

---

### 2. State Management: Frontend vs Backend

**Chosen: Frontend State + localStorage**

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           OPTION COMPARISON                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   Backend State (Database)            Frontend State (CHOSEN)              │
│   ────────────────────────            ──────────────────────               │
│                                                                            │
│   ✓ Survives device changes           ✓ No database infrastructure         │
│   ✓ Multi-device sync                 ✓ Instant state updates              │
│   ✓ Server-side backup                ✓ Works offline for reads            │
│                                       ✓ Simpler deployment                 │
│   ✗ Requires user auth                                                     │
│   ✗ Database infrastructure           ✗ Lost on browser clear              │
│   ✗ Network latency for updates       ✗ Single-device only                 │
│   ✗ More complex backend              ✗ No cross-session persistence       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Why Frontend State:**
- Demo doesn't require multi-device sync
- Faster iteration without database setup
- localStorage provides page-refresh persistence
- Simplifies deployment (no database to manage)

**Trade-off Cost:**
- State lost if user clears browser data
- No ability to resume on different device
- No server-side analytics on task progress

---

### 3. Web Search: Real API vs Simulated Data

**Chosen: Real Web Search (Tavily API)**

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           OPTION COMPARISON                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   Fully Simulated Data                Real Web Search (CHOSEN)             │
│   ────────────────────                ──────────────────────               │
│                                                                            │
│   ✓ No API key required               ✓ Real, current information          │
│   ✓ Predictable demo output           ✓ Location-aware results             │
│   ✓ No rate limiting                  ✓ Demonstrates real capability       │
│   ✓ Works offline                     ✓ Varied, interesting responses      │
│                                                                            │
│   ✗ Fake data feels artificial        ✗ Requires Tavily API key            │
│   ✗ Same results every time           ✗ Rate limits apply                  │
│   ✗ No location awareness             ✗ Network dependency                 │
│   ✗ Doesn't demonstrate real power    ✗ Results vary (less predictable)    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Why Real Web Search:**
- Demonstrates the system's actual capability to find real pharmacies/activities
- Results are genuinely useful (real addresses, real businesses)
- Shows how the system would work in production
- Tavily offers 1000 free searches/month

**Trade-off Cost:**
- Requires API key setup
- Results vary, making demos less predictable
- Network dependency for core functionality

---

### 4. UI Framework: CopilotKit vs Custom Implementation

**Chosen: CopilotKit**

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           OPTION COMPARISON                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   Custom Chat Implementation          CopilotKit (CHOSEN)                  │
│   ──────────────────────────          ─────────────────────                │
│                                                                            │
│   ✓ Full control over UX              ✓ Battle-tested chat UI              │
│   ✓ No vendor dependency              ✓ Built-in tool call rendering       │
│   ✓ Custom streaming logic            ✓ AG-UI protocol (standardized)      │
│                                       ✓ useCopilotReadable for state       │
│                                       ✓ Rapid development                  │
│   ✗ Significant dev time                                                   │
│   ✗ Reinventing solved problems       ✗ Vendor lock-in                     │
│   ✗ Bug-prone streaming code          ✗ Limited customization depth        │
│   ✗ No standards compliance           ✗ Learning curve for API             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Why CopilotKit:**
- Significantly faster development (weeks vs days)
- `useRenderToolCall` enables rich generative UI with minimal code
- `useCopilotReadable` simplifies state sharing with agents
- Active development and good documentation
- AG-UI protocol is an emerging standard

**Trade-off Cost:**
- Vendor dependency (mitigated by AG-UI being a protocol)
- Some UI customization requires working within CopilotKit's model
- Version updates may require migration effort

---

## Technology Choices

### LLM Provider Selection

| Provider | Model | Use Case | Why |
|----------|-------|----------|-----|
| **OpenAI** | gpt-4o-mini | Primary | Best balance of speed, quality, cost |
| **OpenAI** | gpt-4o | Alternative | Higher quality for complex reasoning |
| **Google** | gemini-2.0-flash | Alternative | Free tier, fast |
| **Anthropic** | Claude Sonnet | Alternative | Strong reasoning, safety |

**Trade-off:**
- GPT-4o-mini offers excellent speed and quality at low cost
- Could switch providers based on specific needs (cost, quality, speed)
- LangChain abstraction makes provider switching straightforward

### Framework Selection

| Component | Choice | Alternatives Considered | Why Chosen |
|-----------|--------|------------------------|------------|
| **Frontend** | Next.js 16 | Remix, SvelteKit | App Router, React ecosystem, Vercel deploy |
| **Backend** | FastAPI | Flask, Django | Async support, Pydantic, modern Python |
| **Agent Orchestration** | LangGraph | Autogen, CrewAI | Fine-grained control, StateGraph pattern |
| **Styling** | Tailwind + shadcn/ui | MUI, Chakra | Customizable, accessible, modern |
| **Web Search** | Tavily | Serper, Google | AI-focused API, answer synthesis, free tier |

---

## Implementation Trade-offs

### 1. Agent Prompt Design

**Chosen: Conversational, Information-Gathering Prompts**

```
Before:                              After (Chosen):
─────────────                        ──────────────────

"Find {medicine} near {location}"    "What medicine are you looking for?"
                                     "Where should I search?"
→ Assumes info is provided           → Gathers info conversationally
→ Fails if info missing              → Handles incomplete requests
→ Robotic interaction                → Natural conversation flow
```

**Trade-off:**
- ✓ Better user experience (feels like a helpful assistant)
- ✓ Handles vague or incomplete requests
- ✗ More back-and-forth (slower task completion)
- ✗ More LLM calls (higher cost)

### 2. Error Handling Strategy

**Chosen: Graceful Degradation with User Feedback**

```python
# Pattern used throughout:
if not web_data.get("success"):
    return {
        "error": True,
        "message": f"Could not complete: {error}",
        "suggestion": "Try again or check API key"
    }
```

**Trade-off:**
- ✓ Users see clear, actionable error messages
- ✓ System doesn't crash on external failures
- ✗ Errors are surfaced in natural language (not structured)
- ✗ No automatic retry logic

### 3. Simulated End-Mile Actions

**Chosen: Realistic Simulation with Clear Labeling**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ SIMULATED CALL - For Demonstration Only                            │
│                                                                         │
│  Pharmacist: "Thank you for calling CVS Pharmacy..."                   │
│  You: "Hi, I'm looking for ibuprofen 200mg..."                         │
│  Pharmacist: "Let me check our inventory..."                           │
│  ...                                                                    │
│                                                                         │
│  Result: Medicine reserved under your name                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Trade-off:**
- ✓ Shows complete task flow (end-to-end demonstration)
- ✓ Realistic transcripts show what real integration would look like
- ✓ Clear labeling prevents confusion
- ✗ Not actually useful for real tasks
- ✗ Could mislead users who don't read warnings

---

## Future Considerations

### What Would Change for Production

| Current State | Production Requirement | Migration Path |
|---------------|----------------------|----------------|
| localStorage state | Database + user auth | Add Supabase/Firebase, user login |
| Simulated calls | Real telephony (Twilio) | Replace tool with Twilio integration |
| Single instance | Horizontal scaling | Stateless backend, Redis for session |
| No rate limiting | Usage quotas | Add token counting, user limits |
| English only | Multi-language | i18n for UI, multilingual prompts |

### Scalability Path

```
Current (Demo)                    Production Scale
──────────────                    ─────────────────

1 instance                   →    Kubernetes cluster
localStorage               →    PostgreSQL + Redis
No auth                    →    OAuth 2.0 / SSO
2 task types               →    N task types via registry
Free tier APIs             →    Enterprise API contracts
```

### Technical Debt Acknowledged

1. **No comprehensive test suite** - Would need unit + integration tests for production
2. **Limited error recovery** - No retry logic for transient failures
3. **No observability** - Would need distributed tracing, metrics
4. **No content moderation** - Would need input/output filtering for production
5. **No rate limiting** - Could lead to cost overruns

---

## Summary

The architecture prioritizes:

1. **Developer Experience** - Clear patterns, easy to extend
2. **User Experience** - Conversational, helpful, visual feedback
3. **Demonstration Value** - Shows real capabilities with realistic simulations
4. **Future Flexibility** - Clean abstractions for production migration

The trade-offs made are appropriate for a demonstration system and founding engineer assignment, with clear paths to production-grade implementation where needed.
