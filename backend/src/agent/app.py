import pathlib
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import asyncio

# Import single-agent graph
from agent.graph import graph as single_agent_graph

def calculate_confidence_score(sources: List[str], answer: str, research_loops: int, queries_run: int) -> float:
    """
    Calculate dynamic confidence score based on research quality indicators
    """
    base_score = 0.5  # Start with neutral confidence
    
    # Source quality scoring
    source_score = 0.0
    if len(sources) >= 3:
        source_score = 0.3  # Good source coverage
    elif len(sources) >= 2:
        source_score = 0.2  # Decent source coverage
    elif len(sources) >= 1:
        source_score = 0.1  # Minimal source coverage
    
    # Answer quality scoring (based on length and completeness)
    answer_score = 0.0
    if len(answer) > 500:
        answer_score = 0.2  # Comprehensive answer
    elif len(answer) > 200:
        answer_score = 0.15  # Good answer
    elif len(answer) > 50:
        answer_score = 0.1  # Basic answer
    
    # Research effort scoring
    effort_score = 0.0
    if research_loops >= 2:
        effort_score = 0.1  # Multiple research loops
    if queries_run >= 3:
        effort_score += 0.1  # Multiple queries
    
    # Calculate final score
    final_score = base_score + source_score + answer_score + effort_score
    
    # Cap at 1.0 and ensure minimum of 0.1
    return max(0.1, min(1.0, final_score))

# Define the FastAPI app
app = FastAPI(title="OpenLoop Research Assistant", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class ResearchRequest(BaseModel):
    query: str
    max_research_loops: Optional[int] = None
    reasoning_model: Optional[str] = None
    number_of_initial_queries: Optional[int] = None

class ResearchResponse(BaseModel):
    query: str
    answer: str
    sources: List[str]
    confidence_score: float
    agent_type: str
    metadata: Dict[str, Any]

@app.post("/research", response_model=ResearchResponse)
async def research_endpoint(request: ResearchRequest):
    """
    Research endpoint using single-agent system
    """
    try:
        config = {"configurable": {}}
        if request.max_research_loops:
            config["configurable"]["max_research_loops"] = request.max_research_loops
        if request.reasoning_model:
            config["configurable"]["reasoning_model"] = request.reasoning_model
        if request.number_of_initial_queries:
            config["configurable"]["number_of_initial_queries"] = request.number_of_initial_queries
        
        # Run single agent research
        state = {
            "messages": [HumanMessage(content=request.query)]
        }
        
        result = single_agent_graph.invoke(state, config=config)
        
        # Format sources properly for frontend
        sources_gathered = result.get("sources_gathered", [])
        formatted_sources = []
        for source in sources_gathered:
            if isinstance(source, dict):
                # If source has url and title, format as "title: url"
                url = source.get("url", "")
                title = source.get("title", "")
                if url and title:
                    formatted_sources.append(f"{title}: {url}")
                elif url:
                    formatted_sources.append(url)
            elif isinstance(source, str):
                formatted_sources.append(source)
        
        # Calculate dynamic confidence score
        confidence_score = calculate_confidence_score(
            sources=formatted_sources,
            answer=result["messages"][-1].content,
            research_loops=result.get("research_loop_count", 0),
            queries_run=len(result.get("search_query", []))
        )
        
        return ResearchResponse(
            query=request.query,
            answer=result["messages"][-1].content,
            sources=formatted_sources,
            confidence_score=confidence_score,
            agent_type="single-agent",
            metadata={
                "research_loops": result.get("research_loop_count", 0),
                "queries_run": len(result.get("search_query", []))
            }
        )
            
    except Exception as e:
        return ResearchResponse(
            query=request.query,
            answer=f"Research failed: {str(e)}",
            sources=[],
            confidence_score=0.0,
            agent_type="error",
            metadata={"error": str(e)}
        )

@app.post("/research-stream")
async def research_stream_endpoint(request: ResearchRequest):
    """
    Streaming research endpoint that provides step-by-step progress
    """
    async def generate_stream():
        try:
            print(f"Starting streaming research for query: {request.query}")  # Debug log
            config = {"configurable": {}}
            if request.max_research_loops:
                config["configurable"]["max_research_loops"] = request.max_research_loops
            if request.reasoning_model:
                config["configurable"]["reasoning_model"] = request.reasoning_model
            if request.number_of_initial_queries:
                config["configurable"]["number_of_initial_queries"] = request.number_of_initial_queries
            
            state = {
                "messages": [HumanMessage(content=request.query)]
            }
            
            print(f"Config: {config}")  # Debug log
            print(f"State: {state}")    # Debug log
            
            # Stream the graph execution
            final_result = None
            step_count = 0
            final_state = None
            
            print("Starting graph stream...")  # Debug log
            for chunk in single_agent_graph.stream(state, config=config):
                step_count += 1
                print(f"Received chunk {step_count}: {list(chunk.keys())}")  # Debug log
                
                # Extract node name and data from chunk
                for node_name, node_data in chunk.items():
                    if node_name == "__start__":
                        continue
                    elif node_name == "__end__":
                        # Store the final state
                        final_state = node_data
                        print(f"Final state received: {type(final_state)}")  # Debug log
                        continue
                        
                    print(f"Processing node: {node_name}")  # Debug log
                    
                    # Create meaningful event based on node
                    event_title = ""
                    event_data = ""
                    
                    if node_name == "generate_query":
                        event_title = "Generating Search Queries"
                        if "search_query" in node_data:
                            queries = node_data["search_query"]
                            event_data = f"Generated {len(queries)} search queries: {', '.join(queries[:3])}" + ("..." if len(queries) > 3 else "")
                        else:
                            event_data = "Creating optimized search queries for research"
                            
                    elif node_name == "web_research":
                        event_title = "Web Research"
                        if "search_query" in node_data:
                            query = node_data["search_query"][0] if isinstance(node_data["search_query"], list) else node_data["search_query"]
                            event_data = f"Researching: {query}"
                        else:
                            event_data = "Gathering information from web sources"
                            
                    elif node_name == "reflection":
                        if "is_sufficient" in node_data:
                            if node_data["is_sufficient"]:
                                event_title = "Research Complete"
                                event_data = "Research is sufficient, preparing final answer"
                            else:
                                event_title = "Generating Search Queries"
                                event_data = f"Found knowledge gaps, generating {len(node_data.get('follow_up_queries', []))} follow-up queries"
                        else:
                            event_title = "Research Complete"
                            event_data = "Analyzing research completeness"
                            
                    elif node_name == "finalize_answer":
                        event_title = "Finalizing Answer"
                        event_data = "Synthesizing research into comprehensive response"
                        final_result = node_data
                        print(f"Final result set from finalize_answer: {type(final_result)}")  # Debug log
                    
                    # Send event to frontend
                    if event_title:
                        event = {
                            "type": "step",
                            "step": step_count,
                            "node": node_name,
                            "title": event_title,
                            "data": event_data,
                            "timestamp": step_count
                        }
                        print(f"Sending event: {event}")  # Debug log
                        yield f"data: {json.dumps(event)}\n\n"
                        
                        # Add a small delay to make progress visible
                        await asyncio.sleep(0.1)
            
            print("Graph streaming completed")  # Debug log
            
            # Use final_state if final_result is not set
            if not final_result and final_state:
                final_result = final_state
                print(f"Using final_state as final_result: {type(final_result)}")  # Debug log
            
            # Send final result
            if final_result:
                print(f"Preparing final result: {final_result.keys() if isinstance(final_result, dict) else type(final_result)}")  # Debug log
                
                # Format sources properly for frontend
                sources_gathered = final_result.get("sources_gathered", [])
                formatted_sources = []
                for source in sources_gathered:
                    if isinstance(source, dict):
                        url = source.get("url", "")
                        title = source.get("title", "")
                        if url and title:
                            formatted_sources.append(f"{title}: {url}")
                        elif url:
                            formatted_sources.append(url)
                    elif isinstance(source, str):
                        formatted_sources.append(source)
                
                # Get the answer from messages
                answer = ""
                if "messages" in final_result and final_result["messages"]:
                    answer = final_result["messages"][-1].content
                
                final_event = {
                    "type": "complete",
                    "result": {
                        "query": request.query,
                        "answer": answer,
                        "sources": formatted_sources,
                        "confidence_score": 0.8,
                        "agent_type": "single-agent-streaming",
                        "metadata": {
                            "research_loops": final_result.get("research_loop_count", 0),
                            "queries_run": len(final_result.get("search_query", []))
                        }
                    }
                }
                print(f"Sending final event: {final_event}")  # Debug log
                yield f"data: {json.dumps(final_event)}\n\n"
            else:
                print("No final result to send!")  # Debug log
                
        except Exception as e:
            print(f"Stream error: {e}")  # Debug log
            error_event = {
                "type": "error",
                "error": str(e)
            }
            yield f"data: {json.dumps(error_event)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        }
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "systems": ["single-agent"]}

def create_frontend_router(build_dir="../frontend/dist"):
    """Creates a router to serve the React frontend.

    Args:
        build_dir: Path to the React build directory relative to this file.

    Returns:
        A Starlette application serving the frontend.
    """
    # In Docker, the frontend is at /app/frontend/dist
    # When running locally, it's at ../frontend/dist relative to this file
    build_path = pathlib.Path("/app/frontend/dist")
    if not build_path.exists():
        # Fallback to relative path for local development
        build_path = pathlib.Path(__file__).parent.parent.parent / build_dir

    if not build_path.is_dir() or not (build_path / "index.html").is_file():
        print(
            f"WARN: Frontend build directory not found or incomplete at {build_path}. Serving frontend will likely fail."
        )
        # Return a dummy router if build isn't ready
        from starlette.routing import Route

        async def dummy_frontend(request):
            return Response(
                "Frontend not built. Run 'npm run build' in the frontend directory.",
                media_type="text/plain",
                status_code=503,
            )

        return Route("/{path:path}", endpoint=dummy_frontend)

    return StaticFiles(directory=build_path, html=True)


# Mount the frontend under /app to not conflict with the LangGraph API routes
app.mount(
    "/app",
    create_frontend_router(),
    name="frontend",
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=2024)
