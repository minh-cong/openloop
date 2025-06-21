import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Loader2,
  Activity,
  Info,
  Search,
  TextSearch,
  Brain,
  Pen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

export interface ProcessedEvent {
  title: string;
  data: any;
}

interface ActivityTimelineProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
}

export function ActivityTimeline({
  processedEvents,
  isLoading,
}: ActivityTimelineProps) {
  const [isTimelineCollapsed, setIsTimelineCollapsed] =
    useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new events are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [processedEvents]);
  
  const getEventIcon = (title: string, index: number) => {
    if (index === 0 && isLoading && processedEvents.length === 0) {
      return <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />;
    }
    if (title.toLowerCase().includes("generating")) {
      return <TextSearch className="h-4 w-4 text-neutral-300" />;
    } else if (title.toLowerCase().includes("thinking")) {
      return <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />;
    } else if (title.toLowerCase().includes("reflection")) {
      return <Brain className="h-4 w-4 text-neutral-300" />;
    } else if (title.toLowerCase().includes("research")) {
      return <Search className="h-4 w-4 text-neutral-300" />;
    } else if (title.toLowerCase().includes("finalizing")) {
      return <Pen className="h-4 w-4 text-neutral-200" />;
    }
    return <Activity className="h-4 w-4 text-neutral-400" />;
  };

  useEffect(() => {
    if (!isLoading && processedEvents.length !== 0) {
      setIsTimelineCollapsed(true);
    }
  }, [isLoading, processedEvents]);

  return (
    <Card className="border-none rounded-xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-800/50">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center justify-between">
          <div
            className="flex items-center justify-between w-full cursor-pointer group hover:bg-neutral-800/30 p-2 rounded-lg transition-all duration-200"
            onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-full bg-neutral-800/50 group-hover:bg-neutral-700/50 transition-colors border border-neutral-700/30">
                <Activity className="h-4 w-4 text-neutral-300" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-neutral-100 text-sm">Research Timeline</span>
                <span className="text-xs text-neutral-400">{processedEvents.length} steps completed</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs bg-neutral-800/40 px-2.5 py-1 rounded-full border border-neutral-700/30">
                <span className="text-neutral-300 font-medium">{processedEvents.length}</span>
              </div>
              <div className="p-1 rounded-full bg-neutral-800/30 group-hover:bg-neutral-700/50 transition-colors border border-neutral-700/30">
                {isTimelineCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-neutral-400 group-hover:text-neutral-200 transition-colors" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-neutral-400 group-hover:text-neutral-200 transition-colors" />
                )}
              </div>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      {!isTimelineCollapsed && (
        <CardContent className="pt-0 px-6 pb-4">
          <div 
            ref={scrollContainerRef}
            className="max-h-96 overflow-y-auto overflow-x-hidden relative activity-timeline-scroll"
          >
            {/* Gradient fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-neutral-900/60 to-transparent pointer-events-none z-10" />
            
            {isLoading && processedEvents.length === 0 && (
              <div className="relative pl-8 pb-4">
                <div className="absolute left-3 top-3.5 h-full w-0.5 bg-neutral-800/50" />
                <div className="absolute left-0.5 top-2 h-6 w-6 rounded-full bg-neutral-800/60 flex items-center justify-center ring-4 ring-neutral-900/50 border border-neutral-700/30">
                  <Loader2 className="h-3 w-3 text-neutral-400 animate-spin" />
                </div>
                <div className="ml-1">
                  <p className="text-sm text-neutral-200 font-medium">
                    Initializing search...
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Preparing to gather information
                  </p>
                </div>
              </div>
            )}
            {processedEvents.length > 0 ? (
              <div className="space-y-0">
                {processedEvents.map((eventItem, index) => (
                  <div key={index} className="relative pl-8 pb-4">
                    {index < processedEvents.length - 1 ||
                    (isLoading && index === processedEvents.length - 1) ? (
                      <div className="absolute left-3 top-3.5 h-full w-0.5 bg-neutral-700/40" />
                    ) : null}
                    <div className="absolute left-0.5 top-2 h-6 w-6 rounded-full bg-neutral-800/60 flex items-center justify-center ring-4 ring-neutral-900/50 border border-neutral-700/30">
                      {getEventIcon(eventItem.title, index)}
                    </div>
                    <div className="ml-1">
                      <p className="text-sm text-neutral-200 font-medium mb-1">
                        {eventItem.title}
                      </p>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {typeof eventItem.data === "string"
                          ? eventItem.data
                          : Array.isArray(eventItem.data)
                          ? (eventItem.data as string[]).join(", ")
                          : JSON.stringify(eventItem.data)}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && processedEvents.length > 0 && (
                  <div className="relative pl-8 pb-4">
                    <div className="absolute left-0.5 top-2 h-6 w-6 rounded-full bg-neutral-800/60 flex items-center justify-center ring-4 ring-neutral-900/50 border border-neutral-700/30">
                      <Loader2 className="h-3 w-3 text-neutral-400 animate-spin" />
                    </div>
                    <div className="ml-1">
                      <p className="text-sm text-neutral-200 font-medium">
                        Processing...
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Continuing research
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : !isLoading ? ( // Only show "No activity" if not loading and no events
              <div className="flex flex-col items-center justify-center h-32 text-neutral-500">
                <div className="p-3 rounded-full bg-neutral-800/30 mb-3 border border-neutral-700/30">
                  <Info className="h-6 w-6 text-neutral-400" />
                </div>
                <p className="text-sm font-medium text-neutral-300">No activity yet</p>
                <p className="text-xs text-neutral-500 mt-1 text-center">
                  Timeline will appear during research
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
