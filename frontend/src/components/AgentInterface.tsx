import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, User, CheckCircle, AlertCircle, Brain, Search, FileText, TrendingUp, Shield } from "lucide-react";

interface ResearchResult {
  query: string;
  answer: string;
  sources: string[];
  confidence_score: number;
  agent_type: string;
  metadata: {
    strategy?: any;
    active_agents?: string[];
    research_results_count?: number;
    synthesis?: any;
  };
}

interface MultiAgentInterfaceProps {
  onResult?: (result: ResearchResult) => void;
}

const agentIcons = {
  'academic': <FileText className="w-4 h-4" />,
  'news': <TrendingUp className="w-4 h-4" />,
  'technical': <Brain className="w-4 h-4" />,
  'business': <Search className="w-4 h-4" />,
  'fact_checker': <Shield className="w-4 h-4" />,
  'bias_detector': <AlertCircle className="w-4 h-4" />,
  'credibility_scorer': <CheckCircle className="w-4 h-4" />
};

const agentDescriptions = {
  'academic': 'Scholarly papers and research',
  'news': 'Current events and breaking news',
  'technical': 'Code and technical documentation',
  'business': 'Market data and financial reports',
  'fact_checker': 'Verifies claims and accuracy',
  'bias_detector': 'Identifies potential bias',
  'credibility_scorer': 'Ranks source reliability'
};

export function MultiAgentInterface({ onResult }: MultiAgentInterfaceProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [useMultiAgent, setUseMultiAgent] = useState(false); // Changed to false to use single agent streaming
  const [maxLoops, setMaxLoops] = useState('2');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (useMultiAgent) {
        // Multi-agent API (port 8000)
        const apiUrl = 'http://localhost:8000/research';
        const requestBody = {
          query: query.trim(),
          use_multi_agent: true,
          max_research_loops: parseInt(maxLoops),
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ResearchResult = await response.json();
        setResult(data);
        onResult?.(data);
      } else {
        // Single-agent streaming API (port 2024)
        const apiUrl = 'http://localhost:2024/research-stream';
        const requestBody = {
          query: query.trim(),
          max_research_loops: parseInt(maxLoops),
        };

        const response = await fetch(apiUrl, {
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
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const eventData = JSON.parse(line.slice(6));
                    
                    if (eventData.type === 'step') {
                      // Step events are handled by the parent component
                      // No need to store them here
                    } else if (eventData.type === 'complete') {
                      // Set final result
                      setResult(eventData.result);
                      onResult?.(eventData.result);
                    } else if (eventData.type === 'error') {
                      throw new Error(eventData.error);
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse event data:', parseError);
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {useMultiAgent ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
            {useMultiAgent ? 'Multi-Agent' : 'Single-Agent'} Research System
          </CardTitle>
          <CardDescription>
            {useMultiAgent 
              ? 'Coordinate specialized agents for comprehensive research and analysis'
              : 'Use a single agent for basic research tasks'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-4">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your research query..."
                className="flex-1"
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !query.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Researching...
                  </>
                ) : (
                  'Research'
                )}
              </Button>
            </div>
            
            <div className="flex gap-4 items-center">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="multiAgent"
                  checked={useMultiAgent}
                  onChange={(e) => setUseMultiAgent(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="multiAgent" className="text-sm font-medium">
                  Use Multi-Agent System
                </label>
              </div>
              
              <Select value={maxLoops} onValueChange={setMaxLoops}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Research loops" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Loop</SelectItem>
                  <SelectItem value="2">2 Loops</SelectItem>
                  <SelectItem value="3">3 Loops</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span>Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Tabs defaultValue="answer" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="answer">Answer</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="metadata">Details</TabsTrigger>
          </TabsList>

          {/* Answer Tab */}
          <TabsContent value="answer">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Research Results</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{result.agent_type}</Badge>
                    <div className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${getConfidenceColor(result.confidence_score)}`} />
                      <span className="text-sm text-muted-foreground">
                        {(result.confidence_score * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <div className="whitespace-pre-wrap">{result.answer}</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle>Active Agents</CardTitle>
                <CardDescription>
                  {result.metadata.active_agents?.length || 0} agents participated in this research
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.metadata.active_agents?.map((agentType) => (
                    <div key={agentType} className="flex items-center gap-3 p-3 border rounded-lg">
                      {agentIcons[agentType as keyof typeof agentIcons]}
                      <div>
                        <div className="font-medium capitalize">{agentType.replace('_', ' ')}</div>
                        <div className="text-sm text-muted-foreground">
                          {agentDescriptions[agentType as keyof typeof agentDescriptions]}
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-muted-foreground">No agent information available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle>Sources ({result.sources.length})</CardTitle>
                <CardDescription>
                  References and sources used in the research
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.sources.length > 0 ? (
                    result.sources.map((source, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded">
                        <span className="text-sm text-muted-foreground">#{index + 1}</span>
                        <a
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate flex-1"
                        >
                          {source}
                        </a>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground">No sources available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata">
            <Card>
              <CardHeader>
                <CardTitle>Research Details</CardTitle>
                <CardDescription>
                  Technical details about the research process
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium">Query</div>
                      <div className="text-sm text-muted-foreground">{result.query}</div>
                    </div>
                    <div>
                      <div className="font-medium">Agent Type</div>
                      <div className="text-sm text-muted-foreground">{result.agent_type}</div>
                    </div>
                    <div>
                      <div className="font-medium">Confidence Score</div>
                      <div className="text-sm text-muted-foreground">{(result.confidence_score * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="font-medium">Research Results</div>
                      <div className="text-sm text-muted-foreground">
                        {result.metadata.research_results_count || 0} results
                      </div>
                    </div>
                  </div>
                  
                  {result.metadata.strategy && (
                    <div>
                      <div className="font-medium mb-2">Strategy</div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(result.metadata.strategy, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
