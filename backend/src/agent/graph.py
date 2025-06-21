import os

from agent.tools_and_schemas import SearchQueryList, Reflection
from dotenv import load_dotenv
from langchain_core.messages import AIMessage
from langgraph.types import Send
from langgraph.graph import StateGraph
from langgraph.graph import START, END
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI

from agent.state import (
    OverallState,
    QueryGenerationState,
    ReflectionState,
    WebSearchState,
)
from agent.configuration import Configuration
from agent.prompts import (
    get_current_date,
    query_writer_instructions,
    web_searcher_instructions,
    reflection_instructions,
    answer_instructions,
)
from agent.utils import (
    get_citations,
    get_research_topic,
    insert_citation_markers,
    resolve_urls,
)

try:
    from tavily import TavilyClient
    TAVILY_AVAILABLE = True
except ImportError:
    TAVILY_AVAILABLE = False

load_dotenv()

if os.getenv("OPENAI_API_KEY") is None:
    raise ValueError("OPENAI_API_KEY is not set")

# Nodes
def generate_query(state: OverallState, config: RunnableConfig) -> QueryGenerationState:
    """LangGraph node that generates search queries based on the User's question.

    Uses gpt-4o-mini to create an optimized search queries for web research based on
    the User's question.

    Args:
        state: Current graph state containing the User's question
        config: Configuration for the runnable, including LLM provider settings

    Returns:
        Dictionary with state update, including search_query key containing the generated queries
    """
    configurable = Configuration.from_runnable_config(config)

    # check for custom initial search query count
    if state.get("initial_search_query_count") is None:
        state["initial_search_query_count"] = configurable.number_of_initial_queries
    
    # Check if we're in demo mode (no Tavily key)
    if (not os.getenv("TAVILY_API_KEY") or 
        os.getenv("TAVILY_API_KEY") == "your_tavily_api_key_here"):
        
        # Demo mode - return mock queries
        research_topic = get_research_topic(state["messages"])
        num_queries = state["initial_search_query_count"]
        
        # Generate simple mock queries
        mock_queries = []
        for i in range(num_queries):
            mock_queries.append(f"Query {i+1} about {research_topic}")
        
        return {"search_query": mock_queries}

    # init gpt-4o-mini
    llm = ChatOpenAI(
        model=configurable.query_generator_model,
        temperature=1.0,
        max_retries=2,
        api_key=os.getenv("OPENAI_API_KEY"),
    )
    structured_llm = llm.with_structured_output(SearchQueryList)

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = query_writer_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        number_queries=state["initial_search_query_count"],
    )
    # Generate the search queries
    result = structured_llm.invoke(formatted_prompt)
    return {"search_query": result.query}


def continue_to_web_research(state: QueryGenerationState):
    """LangGraph node that sends the search queries to the web research node.

    This is used to spawn n number of web research nodes, one for each search query.
    """
    return [
        Send("web_research", {"search_query": search_query, "id": int(idx)})
        for idx, search_query in enumerate(state["search_query"])
    ]


def web_research(state: WebSearchState, config: RunnableConfig) -> OverallState:
    """LangGraph node that performs web research using the Tavily API.

    Executes a web search using Tavily API to gather real, detailed information from the web.

    Args:
        state: Current graph state containing the search query and research loop count
        config: Configuration for the runnable, including search API settings

    Returns:
        Dictionary with state update, including sources_gathered, research_loop_count, and web_research_results
    """
    # Configure
    configurable = Configuration.from_runnable_config(config)
    
    search_query = state["search_query"]
    sources_gathered = []
    
    # Check if we're in demo/test mode (no API keys)
    if (not os.getenv("TAVILY_API_KEY") or 
        os.getenv("TAVILY_API_KEY") == "your_tavily_api_key_here" or
        not os.getenv("OPENAI_API_KEY") or
        os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here"):
        
        # Demo mode - return mock data
        sources_gathered = [
            {"url": "https://example.com/source1", "title": f"Research Source 1 for '{search_query}'"},
            {"url": "https://example.com/source2", "title": f"Research Source 2 for '{search_query}'"},
            {"url": "https://example.com/source3", "title": f"Research Source 3 for '{search_query}'"}
        ]
        
        mock_content = f"""Based on research for query: "{search_query}":

1. This is a demo analysis of the topic
2. Key insights and current information would appear here
3. Multiple perspectives are considered in real research
4. Current trends and developments are incorporated
5. Information is up-to-date and relevant

Note: Demo mode - configure TAVILY_API_KEY and OPENAI_API_KEY for real results."""

        return {
            "sources_gathered": sources_gathered,
            "search_query": [search_query],
            "web_research_result": [mock_content],
        }
    
    # Use Tavily for real web search
    if not TAVILY_AVAILABLE:
        raise ImportError("Tavily package is required but not installed. Please install with: pip install tavily-python")
    
    if not os.getenv("TAVILY_API_KEY"):
        raise ValueError("TAVILY_API_KEY environment variable is required but not set")
    
    try:
        tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        search_results = tavily.search(
            query=search_query,
            search_depth="advanced",  # Use advanced search for more detailed results
            max_results=8,  # Increase results for better coverage
            include_answer=True,  # Include AI-generated answer
            include_raw_content=True  # Include full content
        )
        
        # Extract content and URLs from search results
        search_content = []
        for result in search_results.get("results", []):
            url = result.get("url", "")
            title = result.get("title", "")
            content = result.get("content", "")
            raw_content = result.get("raw_content", "")
            
            if url and title:
                sources_gathered.append({"url": url, "title": title})
                # Use raw_content if available for more detail, otherwise use content
                full_content = raw_content if raw_content else content
                search_content.append(f"**{title}**\nURL: {url}\nContent: {full_content}\n{'='*50}")
        
        # Include Tavily's AI answer if available
        tavily_answer = search_results.get("answer", "")
        answer_section = f"\n\nTavily AI Summary:\n{tavily_answer}\n{'='*50}\n" if tavily_answer else ""
        
        # Create comprehensive research summary from real search results
        formatted_prompt = f"""
        Based on the following REAL web search results for query: "{search_query}", 
        create a comprehensive and detailed research summary. Use all the information provided below.
        
        {answer_section}
        
        Detailed Search Results:
        {chr(10).join(search_content)}
        
        Current Date: {get_current_date()}
        
        Instructions:
        - Synthesize ALL the information from the search results above
        - Provide a comprehensive, well-structured summary
        - Include specific details, statistics, and examples from the sources
        - Organize the information logically with clear sections
        - Ensure the summary is thorough and informative (aim for detailed coverage)
        - Reference the key points from multiple sources when applicable
        """
        
    except Exception as e:
        print(f"Tavily search failed: {e}")
        raise RuntimeError(f"Web search failed: {str(e)}. Please check your Tavily API key and connection.")

    # Use OpenAI to process the search results with better model for analysis
    llm = ChatOpenAI(
        model="gpt-4o-mini",  # Use consistent model
        temperature=0.1,  # Slightly more creative while staying factual
        max_retries=2,
        api_key=os.getenv("OPENAI_API_KEY"),
    )
    
    response = llm.invoke(formatted_prompt)
    modified_text = response.content

    return {
        "sources_gathered": sources_gathered,
        "search_query": [search_query],
        "web_research_result": [modified_text],
    }


def reflection(state: OverallState, config: RunnableConfig) -> ReflectionState:
    """LangGraph node that identifies knowledge gaps and generates potential follow-up queries.

    Analyzes the current summary to identify areas for further research and generates
    potential follow-up queries. Uses structured output to extract
    the follow-up query in JSON format.

    Args:
        state: Current graph state containing the running summary and research topic
        config: Configuration for the runnable, including LLM provider settings

    Returns:
        Dictionary with state update, including search_query key containing the generated follow-up query
    """
    configurable = Configuration.from_runnable_config(config)
    # Increment the research loop count and get the reasoning model
    state["research_loop_count"] = state.get("research_loop_count", 0) + 1
    reasoning_model = state.get("reasoning_model", configurable.reflection_model)
    
    # Check if we're in demo mode (no Tavily key)
    if (not os.getenv("TAVILY_API_KEY") or 
        os.getenv("TAVILY_API_KEY") == "your_tavily_api_key_here"):
        
        # Demo mode - return mock reflection
        research_loop_count = state["research_loop_count"]
        max_loops = configurable.max_research_loops
        
        if research_loop_count >= max_loops:
            # Consider research sufficient
            return {
                "is_sufficient": True,
                "knowledge_gap": "Research is sufficient for demo purposes",
                "follow_up_queries": [],
                "research_loop_count": research_loop_count,
                "number_of_ran_queries": len(state["search_query"]),
            }
        else:
            # Generate mock follow-up queries
            topic = get_research_topic(state["messages"])
            return {
                "is_sufficient": False,
                "knowledge_gap": f"Additional information needed about {topic}",
                "follow_up_queries": [f"More details about {topic}", f"Recent updates on {topic}"],
                "research_loop_count": research_loop_count,
                "number_of_ran_queries": len(state["search_query"]),
            }

    # Format the prompt
    current_date = get_current_date()
    formatted_prompt = reflection_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        summaries="\n\n---\n\n".join(state["web_research_result"]),
    )
    # init Reasoning Model
    llm = ChatOpenAI(
        model=reasoning_model,
        temperature=1.0,
        max_retries=2,
        api_key=os.getenv("OPENAI_API_KEY"),
    )
    result = llm.with_structured_output(Reflection).invoke(formatted_prompt)

    return {
        "is_sufficient": result.is_sufficient,
        "knowledge_gap": result.knowledge_gap,
        "follow_up_queries": result.follow_up_queries,
        "research_loop_count": state["research_loop_count"],
        "number_of_ran_queries": len(state["search_query"]),
    }


def evaluate_research(
    state: ReflectionState,
    config: RunnableConfig,
) -> OverallState:
    """LangGraph routing function that determines the next step in the research flow.

    Controls the research loop by deciding whether to continue gathering information
    or to finalize the summary based on the configured maximum number of research loops.

    Args:
        state: Current graph state containing the research loop count
        config: Configuration for the runnable, including max_research_loops setting

    Returns:
        String literal indicating the next node to visit ("web_research" or "finalize_summary")
    """
    configurable = Configuration.from_runnable_config(config)
    max_research_loops = (
        state.get("max_research_loops")
        if state.get("max_research_loops") is not None
        else configurable.max_research_loops
    )
    if state["is_sufficient"] or state["research_loop_count"] >= max_research_loops:
        return "finalize_answer"
    else:
        return [
            Send(
                "web_research",
                {
                    "search_query": follow_up_query,
                    "id": state["number_of_ran_queries"] + int(idx),
                },
            )
            for idx, follow_up_query in enumerate(state["follow_up_queries"])
        ]


def finalize_answer(state: OverallState, config: RunnableConfig):
    """LangGraph node that finalizes the research summary.

    Prepares the final output by deduplicating and formatting sources, then
    combining them with the running summary to create a well-structured
    research report with proper citations.

    Args:
        state: Current graph state containing the running summary and sources gathered

    Returns:
        Dictionary with state update, including running_summary key containing the formatted final summary with sources
    """
    configurable = Configuration.from_runnable_config(config)
    reasoning_model = state.get("reasoning_model") or configurable.answer_model
    
    # Check if we're in demo mode (no Tavily key)
    if (not os.getenv("TAVILY_API_KEY") or 
        os.getenv("TAVILY_API_KEY") == "your_tavily_api_key_here"):
        
        # Demo mode - return mock final answer
        research_topic = get_research_topic(state["messages"])
        research_results = state.get("web_research_result", [])
        
        # Create a simple final answer for demo
        demo_answer = f"""# Research Results for: {research_topic}

Based on the research conducted, here are the key findings:

## Summary
{chr(10).join(research_results)}

## Conclusion
This research provides comprehensive information about {research_topic}. The findings are based on multiple sources and current as of {get_current_date()}.

*Note: This is a demo response. Configure your API keys for actual web research and AI-powered analysis.*
"""
        
        unique_sources = state.get("sources_gathered", [])
        return {
            "messages": [AIMessage(content=demo_answer)],
            "sources_gathered": unique_sources,
        }

    # Format the prompt with actual sources
    current_date = get_current_date()
    
    # Create detailed sources section for the prompt
    sources_text = ""
    if state.get("sources_gathered"):
        sources_text = "\n\n## Sources found during research:\n"
        for i, source in enumerate(state["sources_gathered"], 1):
            if isinstance(source, dict):
                url = source.get("url", "")
                title = source.get("title", "")
                if url and title:
                    sources_text += f"{i}. **{title}**: {url}\n"
                elif url:
                    sources_text += f"{i}. {url}\n"
    
    # Enhanced prompt that emphasizes using actual sources
    research_content = "\n---\n\n".join(state["web_research_result"])
    full_content = research_content + sources_text
    
    formatted_prompt = answer_instructions.format(
        current_date=current_date,
        research_topic=get_research_topic(state["messages"]),
        summaries=full_content,
    )
    
    # Add specific instruction about sources
    formatted_prompt += "\n\nIMPORTANT: When including sources in your answer, use the EXACT URLs provided above in the sources section. Format them as markdown links like [website name](actual_url). DO NOT use placeholder URLs."

    # init Reasoning Model, default to gpt-4o-mini
    llm = ChatOpenAI(
        model=reasoning_model,
        temperature=0,
        max_retries=2,
        api_key=os.getenv("OPENAI_API_KEY"),
    )
    result = llm.invoke(formatted_prompt)

    # Use actual sources gathered from web research
    unique_sources = state.get("sources_gathered", [])
    return {
        "messages": [AIMessage(content=result.content)],
        "sources_gathered": unique_sources,
    }


# Create our Agent Graph
builder = StateGraph(OverallState, config_schema=Configuration)

# Define the nodes we will cycle between
builder.add_node("generate_query", generate_query)
builder.add_node("web_research", web_research)
builder.add_node("reflection", reflection)
builder.add_node("finalize_answer", finalize_answer)

# Set the entrypoint as `generate_query`
# This means that this node is the first one called
builder.add_edge(START, "generate_query")
# Add conditional edge to continue with search queries in a parallel branch
builder.add_conditional_edges(
    "generate_query", continue_to_web_research, ["web_research"]
)
# Reflect on the web research
builder.add_edge("web_research", "reflection")
# Evaluate the research
builder.add_conditional_edges(
    "reflection", evaluate_research, ["web_research", "finalize_answer"]
)
# Finalize the answer
builder.add_edge("finalize_answer", END)

graph = builder.compile(name="pro-search-agent")
