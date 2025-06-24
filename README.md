# OpenLoop Research

AI research assistant that searches the web and synthesizes comprehensive answers. Built with LangGraph, OpenAI, and real-time web search.

## How it works

1. Takes a question and generates optimized search queries
2. Searches the web using Tavily API
3. Reflects on information gaps and searches more if needed
4. Synthesizes final answer with proper citations

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- OpenAI API key
- Tavily API key (required, for web search)

### Setup

Backend:
```bash
cd backend
pip install -e .
echo "OPENAI_API_KEY=your_key" > .env
echo "TAVILY_API_KEY=your_key" >> .env
python -m agent.app
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Access at http://localhost:5173

## Configuration

Set environment variables in `backend/.env`:
```
OPENAI_API_KEY=your_openai_api_key
TAVILY_API_KEY=your_tavily_api_key
```

## Docker Deployment

```bash
./deploy.sh
```

Access at http://localhost:3000

## Stack

- Backend: FastAPI + LangGraph + OpenAI + Tavily
- Frontend: React + TypeScript + Vite + TailwindCSS

## API Usage

REST endpoint:
```python
import requests

response = requests.post("http://localhost:2024/research", json={
    "query": "Your question here",
    "max_research_loops": 3,
    "reasoning_model": "gpt-4o-mini"
})

result = response.json()
print(result['answer'])
```

## License

MIT 
