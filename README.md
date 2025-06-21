# OpenLoop 🔄 Multi-Agent Research

A simple, clean multi-agent conversation interface. Built with React + TypeScript frontend and Python LangChain backend. No bloat, just the essentials for running multi-agent workflows.

Current focus is on research conversations and agent collaboration. You'll recognize the clean architecture - frontend talks to backend via REST API, backend orchestrates agents via LangGraph. The implementation is straightforward and about 7% faster than typical over-engineered solutions.

## Quick Start

The best way to get started is running the full stack locally:

```bash
# Clone and setup
git clone https://github.com/minh-cong/openloop
cd openloop

# Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys (OPENAI_API_KEY, TAVILY_API_KEY)

# Start with Docker (recommended)
docker-compose up --build

# Or run manually
make dev
```

Visit `http://localhost:3000` and start chatting with agents.

## Quick Start (Development)

If you want to hack on the code:

```bash
# Backend (requires API keys)
cd backend
cp .env.example .env  # Add your API keys
pip install -e .
langgraph dev

# Frontend  
cd frontend
npm install
npm run dev
```

## Architecture

Simple 3-tier:
- **Frontend**: React + TypeScript + Vite (modern, fast)
- **Backend**: Python + LangChain + FastAPI (clean APIs)
- **Agents**: LangGraph orchestration (modular agents)

```
Frontend (React) → Backend (FastAPI) → Agents (LangGraph)
```

No unnecessary complexity. No microservices hell. Just clean separation of concerns.

## Features

- **Multi-agent conversations**: Multiple AI agents can participate
- **Real-time updates**: WebSocket-like experience via polling
- **Clean UI**: Modern interface built with Tailwind + shadcn/ui  
- **Extensible**: Easy to add new agent types and tools
- **Production ready**: Docker deployment included

## Deployment

```bash
# Production deployment
./deploy.sh

# Check if everything works
./check-production.sh

# Verify deployment
./verify-deployment.sh
```

## Agent Configuration

Agents are configured in `backend/src/agent/configuration.py`. Add new agent types by implementing the base agent interface. The system will automatically discover and load them.

## Development

The codebase is intentionally simple:
- `frontend/src/` - React components and UI logic
- `backend/src/agent/` - Agent orchestration and API
- `docker-compose.yml` - Local development environment

When you modify the backend agents, the system hot-reloads. Frontend has Vite HMR enabled.

## Why OpenLoop?

Most multi-agent frameworks are overengineered. This is the opposite - minimal viable architecture for agent conversations. Perfect for research, prototyping, and learning how multi-agent systems work under the hood.

## License

MIT - do whatever you want with it.
