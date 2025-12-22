# Pokus AI - Real-World Task Completion System

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2.76-green)](https://github.com/langchain-ai/langgraph)
[![CopilotKit](https://img.shields.io/badge/CopilotKit-1.50-purple)](https://copilotkit.ai/)

A multi-agent AI system that completes real-world tasks end-to-end, not just answers questions. Built for the Pokus.ai Founding Engineer assignment.

## 🎯 Overview

Most AI assistants stop at suggestions. This system **completes tasks**:

| Task | What It Does |
|------|-------------|
| **🏥 Find Medicine** | Searches real pharmacies via web search, checks availability, simulates calls to reserve |
| **✈️ Plan Travel** | Gathers preferences, generates multi-day itineraries with real activity data, refines based on feedback |

### Key Features

- **True Multi-Agent Architecture** - Supervisor agent routes to specialized Medicine/Travel agents, each with their own LLM
- **Real Web Search** - Tavily API integration for actual pharmacy and activity data
- **Generative UI** - Dynamic interfaces that adapt to task progress
- **Simulated End-Mile** - Realistic call transcripts (clearly labeled as simulated)
- **Scalable Design** - Task registry pattern for easy addition of new task types
- **Docker Ready** - Full containerized deployment with docker-compose

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.10+
- API Keys (see below)

### API Keys Required

| Key | Purpose | Get It |
|-----|---------|--------|
| `OPENAI_API_KEY` | OpenAI LLM | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `TAVILY_API_KEY` | Web search for real data | [Tavily](https://tavily.com/) (1000 free/month) |
| `LANGSMITH_API_KEY` | Tracing (optional) | [LangSmith](https://smith.langchain.com/) |

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/pokus-task.git
cd pokus-task

# Install frontend dependencies
pnpm install

# Install backend dependencies
cd apps/agents
pip install -r requirements.txt
cd ../..
```

### Environment Setup

```bash
# Backend environment
cp apps/agents/.env.example apps/agents/.env
# Edit apps/agents/.env with your API keys

# Frontend environment  
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your API keys
```

### Running Locally

**Terminal 1 - Backend:**
```bash
cd apps/agents
uvicorn src.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running with Docker

```bash
# Copy env file for docker-compose
cp .env.example .env
# Edit .env with your API keys

# Build and run
docker-compose up --build
```

## 📁 Project Structure

```
pokus-task/
├── apps/
│   ├── web/                    # Next.js 16 frontend
│   │   ├── app/
│   │   │   ├── page.tsx        # Landing page
│   │   │   ├── chat/
│   │   │   │   └── page.tsx    # Unified chat (medicine + travel)
│   │   │   └── api/
│   │   │       └── copilotkit/ # CopilotKit endpoint
│   │   ├── components/
│   │   │   ├── ui/             # Base UI components
│   │   │   └── tasks/          # Task-specific components
│   │   ├── lib/
│   │   │   └── hooks.ts        # Custom hooks (persistence)
│   │   └── .env.example        # Frontend env template
│   │
│   └── agents/                 # Python backend
│       └── src/
│           ├── main.py         # FastAPI entry + health check
│           ├── task_registry.py # Scalable task registration
│           ├── agents/
│           │   ├── supervisor.py   # Multi-agent orchestrator
│           │   ├── medicine.py     # Medicine agent + tools
│           │   └── travel.py       # Travel agent + tools
│           └── utils/
│               └── web_search.py   # Tavily search utilities
│
├── docker-compose.yaml         # Container orchestration
├── .env.example                # Root env template
├── DESIGN.md                   # Architecture documentation
└── README.md                   # This file
```

## 🏗️ Architecture

```
                    ┌──────────────────────┐
                    │     User Browser     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Next.js Frontend   │
                    │   + CopilotKit UI    │
                    │   + Generative UI    │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   FastAPI Backend    │
                    │   + CopilotKit SDK   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   SUPERVISOR AGENT   │
                    │   (Router LLM)       │
                    └──────────┬───────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                                           ▼
┌─────────────────┐                       ┌─────────────────┐
│ MEDICINE AGENT  │                       │  TRAVEL AGENT   │
│   (Own LLM)     │                       │   (Own LLM)     │
│                 │                       │                 │
│• search_pharma  │                       │• update_prefs   │
│• check_avail    │                       │• gen_itinerary  │
│• call_pharmacy  │                       │• modify_itin    │
│• select_pharma  │                       │• search_acts    │
└────────┬────────┘                       └────────┬────────┘
         │                                         │
         └──────────────────┬──────────────────────┘
                            ▼
                  ┌─────────────────┐
                  │   Tavily API    │
                  │  (Web Search)   │
                  └─────────────────┘
```

See [DESIGN.md](DESIGN.md) for detailed architecture documentation.

## 📋 Usage Examples

### Medicine Finder

```
User: "Find paracetamol near downtown San Francisco"

Agent: 1. Searches for nearby pharmacies
       2. Shows list with distances and ratings
       3. Checks availability at selected pharmacy
       4. Offers to call to confirm and reserve
       5. Generates simulated call transcript
       6. Provides pickup instructions
```

### Travel Planner

```
User: "Create an itinerary for Bali"

Agent: 1. Asks about dates, budget, interests
       2. Stores preferences as gathered
       3. Generates day-by-day itinerary
       4. Shows activities, restaurants, costs
       5. Allows refinement ("add more beach time")
       6. Provides exportable final plan
```

## 🧪 Development

### Frontend Development

```bash
cd apps/web

# Run with hot reload
pnpm dev

# Type checking
pnpm lint

# Build for production
pnpm build
```

### Backend Development

```bash
cd apps/agents

# Run with auto-reload
uvicorn src.main:app --reload --port 8000

# Health check
curl http://localhost:8000/health
```

### Adding a New Task

The system uses a **Task Registry Pattern** for easy extensibility:

1. **Create agent & tools** in `apps/agents/src/agents/new_task.py`
2. **Register the task** in `apps/agents/src/task_registry.py`:
   ```python
   task_registry.register(
       TaskDefinition(
           id="new_task",
           name="New Task Name",
           description="What this task does",
           keywords=["keyword1", "keyword2"],
           agent_creator=create_new_task_agent
       )
   )
   ```
3. **Add supervisor routing** in `apps/agents/src/agents/supervisor.py`
4. **Create UI components** in `apps/web/components/tasks/new_task/`
5. **Add tool renders** in `apps/web/app/chat/page.tsx` for new tools

## 🔧 Configuration

### Environment Variables

#### Backend (apps/agents/.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for LLM |
| `TAVILY_API_KEY` | Yes | Web search API key |
| `FRONTEND_URL` | No | CORS origin (default: `http://localhost:3000`) |
| `LOG_LEVEL` | No | Logging verbosity: DEBUG, INFO, WARNING, ERROR (default: `INFO`) |
| `LANGSMITH_TRACING` | No | Enable LangSmith tracing (default: `true`) |
| `LANGSMITH_API_KEY` | No | LangSmith API key for tracing |
| `LANGSMITH_PROJECT` | No | LangSmith project name (default: `pokus-ai`) |

#### Frontend (apps/web/.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Same key as backend |
| `NEXT_PUBLIC_AGENT_URL` | No | Backend URL (default: `http://localhost:8000`) |
| `AGENT_URL` | No | Backend URL for server-side (default: `http://localhost:8000`) |

### LLM Provider

The system uses OpenAI GPT-4 as the LLM:

```bash
# Get your API key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_key
```

### Web Search

Tavily API provides real pharmacy and activity search:

```bash
# Get free key at: https://tavily.com/ (1000 searches/month)
TAVILY_API_KEY=your_key
```

## 📝 Design Decisions

| Decision | Rationale |
|----------|-----------|
| **True Multi-Agent** | Supervisor + specialized agents with separate LLMs for better task isolation |
| **LangGraph StateGraph** | Structured routing and state management across agents |
| **Tavily Web Search** | Real pharmacy/activity data instead of hardcoded mock data |
| **Task Registry** | Scalable pattern for adding new task types without modifying core code |
| **CopilotKit Generative UI** | Rich, dynamic UI components triggered by agent actions |
| **localStorage Persistence** | Simple client-side state persistence without backend database |

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend | Next.js | 16.1.0 |
| UI Framework | CopilotKit | 1.50.1 |
| Styling | Tailwind CSS | 3.4.1 |
| Components | Radix UI | Latest |
| Backend | FastAPI | 0.115.x |
| Agent Framework | LangGraph | 0.3.25+ |
| LLM Integration | LangChain | 0.3.3+ |
| CopilotKit Python | copilotkit | 0.1.74 |
| Default LLM | OpenAI GPT-4 | - |
| Web Search | Tavily API | - |
| Containerization | Docker | - |

## 🚧 Limitations & Future Work

### Current Limitations

- Call transcripts are simulated (clearly labeled)
- No persistent backend database (uses localStorage)
- No authentication/multi-user support
- English language only

### Future Improvements

- [ ] Real pharmacy reservation APIs (GoodRx, etc.)
- [ ] Travel booking APIs (Amadeus, Booking.com)
- [ ] PostgreSQL/Redis for persistent sessions
- [ ] Voice interface integration
- [ ] Mobile app companion
- [ ] Multi-language support
- [ ] WebSocket for real-time updates

## 🤝 Contributing

This is an assignment project, but feedback is welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 👤 Author

Built for the [Pokus.ai](https://pokus.ai) Founding Engineer Assignment.

---

<p align="center">
  <strong>Not just answers — task completion.</strong>
</p>
