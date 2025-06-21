import { useState, useEffect, useRef, useCallback } from "react";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { Button } from "@/components/ui/button";

// Define Message type locally
interface Message {
  type: "human" | "ai";
  content: string;
  id: string;
}

export default function App() {
  const [processedEventsTimeline, setProcessedEventsTimeline] = useState<
    ProcessedEvent[]
  >([]);
  const [historicalActivities, setHistoricalActivities] = useState<
    Record<string, ProcessedEvent[]>
  >({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasFinalizeEventOccurredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Custom hook to replace useStream
  const thread = {
    messages,
    isLoading,
    submit: async (config: {
      messages: Message[];
      initial_search_query_count: number;
      max_research_loops: number;
      reasoning_model: string;
    }) => {
      setIsLoading(true);
      setError(null);
      setMessages(config.messages);
      setProcessedEventsTimeline([]); // Reset events
      
      try {
        const apiUrl = import.meta.env.DEV ? "http://localhost:2024" : "";
        const endpoint = "/research-stream";
        
        // Get the user query from the latest message
        const userQuery = config.messages[config.messages.length - 1]?.content || "";
        
        const requestBody = {
          query: userQuery,
          max_research_loops: config.max_research_loops,
          number_of_initial_queries: config.initial_search_query_count,
          reasoning_model: config.reasoning_model,
        };

        const response = await fetch(`${apiUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              console.log('Received chunk:', chunk); // Debug log
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const eventData = JSON.parse(line.slice(6));
                    console.log('Parsed event:', eventData); // Debug log
                    
                    if (eventData.type === 'step') {
                      // Add step to timeline
                      setProcessedEventsTimeline(prev => [...prev, {
                        title: eventData.title,
                        data: eventData.data
                      }]);
                    } else if (eventData.type === 'complete') {
                      // Set final result
                      const result = eventData.result;
                      console.log('Final result:', result); // Debug log
                      
                      // Add AI response to messages
                      setMessages(prev => [...prev, {
                        type: "ai",
                        content: result.answer,
                        id: Date.now().toString(),
                      }]);
                      
                      // Add final step
                      setProcessedEventsTimeline(prev => [...prev, {
                        title: "Research Complete",
                        data: `Confidence: ${Math.round(result.confidence_score * 100)}%`,
                      }]);
                      
                      hasFinalizeEventOccurredRef.current = true;
                    } else if (eventData.type === 'error') {
                      console.error('Stream error:', eventData.error); // Debug log
                      throw new Error(eventData.error);
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse event data:', parseError, 'Line:', line);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
        
      } catch (error) {
        console.error('Error in API call:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    stop: () => {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (
      hasFinalizeEventOccurredRef.current &&
      !isLoading &&
      messages.length > 0
    ) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === "ai" && lastMessage.id) {
        setHistoricalActivities((prev) => ({
          ...prev,
          [lastMessage.id!]: [...processedEventsTimeline],
        }));
      }
      hasFinalizeEventOccurredRef.current = false;
    }
  }, [messages, isLoading, processedEventsTimeline]);

  const handleSubmit = useCallback(
    (submittedInputValue: string, effort: string, model: string) => {
      if (!submittedInputValue.trim()) return;
      setProcessedEventsTimeline([]);
      hasFinalizeEventOccurredRef.current = false;

      // convert effort to, initial_search_query_count and max_research_loops
      // low means max 1 loop and 1 query
      // medium means max 3 loops and 3 queries
      // high means max 10 loops and 5 queries
      let initial_search_query_count = 0;
      let max_research_loops = 0;
      switch (effort) {
        case "low":
          initial_search_query_count = 1;
          max_research_loops = 1;
          break;
        case "medium":
          initial_search_query_count = 3;
          max_research_loops = 3;
          break;
        case "high":
          initial_search_query_count = 5;
          max_research_loops = 10;
          break;
      }

      const newMessages: Message[] = [
        ...(messages || []),
        {
          type: "human",
          content: submittedInputValue,
          id: Date.now().toString(),
        },
      ];
      thread.submit({
        messages: newMessages,
        initial_search_query_count: initial_search_query_count,
        max_research_loops: max_research_loops,
        reasoning_model: model,
      });
    },
    [messages, thread]
  );

  const handleCancel = useCallback(() => {
    thread.stop();
    window.location.reload();
  }, [thread]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-neutral-100 font-sans antialiased">
      <main className="h-full w-full max-w-5xl mx-auto p-4">
        <div className="h-full rounded-xl border border-neutral-700 bg-neutral-800/50 backdrop-blur-sm shadow-2xl">
          {messages.length === 0 ? (
            <WelcomeScreen
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              onCancel={handleCancel}
            />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="flex flex-col items-center justify-center gap-6 p-8 rounded-lg bg-red-900/20 border border-red-500/30">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-2xl text-red-400 font-bold">Research Error</h1>
                <p className="text-red-300 text-center max-w-md">{error}</p>
                <Button
                  variant="destructive"
                  onClick={() => window.location.reload()}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <ChatMessagesView
              messages={messages}
              isLoading={isLoading}
              scrollAreaRef={scrollAreaRef}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              liveActivityEvents={processedEventsTimeline}
              historicalActivities={historicalActivities}
            />
          )}
        </div>
      </main>
    </div>
  );
}
