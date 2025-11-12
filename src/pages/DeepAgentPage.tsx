/**
 * DeepAgent Page
 * Run deep agents on documents for comprehensive analysis
 */
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  FileText,
  Loader2,
  Clock,
  History,
  Trash2,
  CheckCircle2,
  XCircle,
  Play,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { MarkdownWithPageLinks } from "@/components/MarkdownWithPageLinks";
import { PdfViewer } from "@/components/PdfViewer";
import { authenticatedFetch } from "@/lib/api-client";
import { useDocuments } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { AgentRunWithDocument } from "@/types/database";

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  estimatedDuration?: string;
}

export function DeepAgentPage() {
  const { t } = useTranslation();
  const { data: documents } = useDocuments();

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [history, setHistory] = useState<AgentRunWithDocument[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<{
    documentId: number;
    filename: string;
    pageNumber: number;
  } | null>(null);

  const completedDocs =
    documents?.filter((d) => d.processing_status === "completed") || [];

  // Fetch agents on mount
  useState(() => {
    authenticatedFetch("/api/deepagent/agents")
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch((err) => {
        console.error("Failed to fetch agents:", err);
        toast.error("Failed to load agent configurations");
      });
  });

  // Fetch history on mount
  useState(() => {
    authenticatedFetch("/api/deepagent/history?limit=20")
      .then((res) => res.json())
      .then((data) => setHistory(data))
      .catch((err) => {
        console.error("Failed to fetch history:", err);
      });
  });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedDocument = completedDocs.find(
    (d) => d.id.toString() === selectedDocumentId
  );

  const pollingIntervalRef = useRef<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastScrollPosition = useRef<number>(0);

  // Poll for agent run status
  const pollRunStatus = async (currentRunId: string) => {
    try {
      const response = await authenticatedFetch(`/api/deepagent/runs/${currentRunId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get run status");
      }

      if (data.status === "completed") {
        setResult(data.result);
        setDurationSeconds(data.duration_seconds);
        setIsRunning(false);
        toast.success(`Analysis completed in ${data.duration_seconds}s`);

        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Refresh history
        const historyRes = await authenticatedFetch("/api/deepagent/history?limit=20");
        const historyData = await historyRes.json();
        setHistory(historyData);
      } else if (data.status === "failed") {
        setIsRunning(false);
        toast.error(data.error || "Agent execution failed");

        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
      // If still running, polling will continue
    } catch (error) {
      console.error("Failed to poll status:", error);
      // Don't stop polling on network errors
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleRun = async () => {
    if (!selectedAgentId) {
      toast.error("Please select an agent");
      return;
    }

    if (!selectedDocumentId) {
      toast.error("Please select a document");
      return;
    }

    setIsRunning(true);
    setResult(null);
    setRunId(null);
    setDurationSeconds(null);

    try {
      const response = await authenticatedFetch("/api/deepagent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentConfigId: selectedAgentId,
          documentId: parseInt(selectedDocumentId, 10),
          query: query.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start agent run");
      }

      // Agent run started successfully
      const currentRunId = data.id;
      setRunId(currentRunId);
      toast.success("Agent run started! This may take several minutes...");

      // Start polling for status (every 3 seconds)
      pollingIntervalRef.current = setInterval(() => {
        pollRunStatus(currentRunId);
      }, 3000) as unknown as number;

      // Do initial poll immediately
      pollRunStatus(currentRunId);
    } catch (error) {
      console.error("Failed to start agent run:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start agent run"
      );
      setIsRunning(false);
    }
  };

  const handleHistorySelect = async (run: AgentRunWithDocument) => {
    setResult(run.result);
    setRunId(run.id);
    setDurationSeconds(run.duration_seconds);
    setSelectedAgentId(run.agent_config_id);
    setSelectedDocumentId(run.document_id.toString());
    setQuery(run.query);
    setIsHistoryOpen(false);
  };

  const handlePageClick = (pageNumber: number) => {
    if (!selectedDocument) {
      toast.error("Document not found");
      return;
    }

    // Save current scroll position before state update
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      lastScrollPosition.current = viewport.scrollTop;
    }

    setSelectedPdf({
      documentId: selectedDocument.id,
      filename: selectedDocument.filename,
      pageNumber,
    });
  };

  // Restore scroll position after PDF dialog state changes
  useEffect(() => {
    if (selectedPdf) {
      // Restore scroll position after a small delay to allow React to render
      const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport && lastScrollPosition.current > 0) {
        setTimeout(() => {
          viewport.scrollTop = lastScrollPosition.current;
        }, 0);
      }
    }
  }, [selectedPdf]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div
        className={`flex flex-col flex-1 overflow-hidden ${selectedPdf ? "pr-[min(50vw,calc(100vw-var(--sidebar-width,16rem)-24rem))]" : ""}`}
        style={{ transition: "padding-right 0.3s ease" }}
      >
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Bot className="w-8 h-8" />
                {t("deepAgent.title")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("deepAgent.description")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History className="w-4 h-4 mr-2" />
              {t("deepAgent.history")}
            </Button>
          </div>

          <Tabs defaultValue="run" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="run">{t("deepAgent.tabs.run")}</TabsTrigger>
              <TabsTrigger value="result" disabled={!result}>
                {t("deepAgent.tabs.result")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="run" className="space-y-4">
              {/* Configuration Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("deepAgent.configuration.title")}</CardTitle>
                  <CardDescription>
                    {t("deepAgent.configuration.description")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Agent Selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("deepAgent.configuration.agent")}
                    </label>
                    <Select
                      value={selectedAgentId}
                      onValueChange={setSelectedAgentId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("deepAgent.configuration.selectAgent")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{agent.name}</span>
                              {agent.estimatedDuration && (
                                <span className="text-xs text-muted-foreground">
                                  {t("deepAgent.configuration.duration")}: {agent.estimatedDuration}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAgent && (
                      <p className="text-sm text-muted-foreground">
                        {selectedAgent.description}
                      </p>
                    )}
                  </div>

                  {/* Document Selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("deepAgent.configuration.document")}
                    </label>
                    <Select
                      value={selectedDocumentId}
                      onValueChange={setSelectedDocumentId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("deepAgent.configuration.selectDocument")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {completedDocs.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id.toString()}>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span>{doc.filename}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {completedDocs.length === 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        {t("deepAgent.configuration.noDocuments")}
                      </div>
                    )}
                  </div>

                  {/* Query Input (Optional) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("deepAgent.configuration.query")}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({t("deepAgent.configuration.optional")})
                      </span>
                    </label>
                    <Textarea
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t("deepAgent.configuration.queryPlaceholder")}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("deepAgent.configuration.queryHint")}
                    </p>
                  </div>

                  {/* Run Button */}
                  <Button
                    onClick={handleRun}
                    disabled={isRunning || !selectedAgentId || !selectedDocumentId}
                    className="w-full"
                    size="lg"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("deepAgent.configuration.running")}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        {t("deepAgent.configuration.run")}
                      </>
                    )}
                  </Button>

                  {isRunning && selectedAgent?.estimatedDuration && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {t("deepAgent.configuration.estimatedTime")}: {selectedAgent.estimatedDuration}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="result" className="space-y-4">
              {result && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{t("deepAgent.result.title")}</CardTitle>
                        <CardDescription>
                          {selectedAgent?.name} • {selectedDocument?.filename}
                        </CardDescription>
                      </div>
                      {durationSeconds && (
                        <Badge variant="secondary">
                          <Clock className="w-3 h-3 mr-1" />
                          {durationSeconds}s
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Click on page references to open the PDF
                    </div>
                    <ScrollArea ref={scrollAreaRef} className="h-[600px] w-full rounded-md border p-4">
                      <MarkdownWithPageLinks
                        content={result}
                        onPageClick={handlePageClick}
                      />
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("deepAgent.history")}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("deepAgent.noHistory")}
                </div>
              ) : (
                history.map((run) => (
                  <Card
                    key={run.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleHistorySelect(run)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="mt-0.5">
                            {getStatusIcon(run.status)}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{run.agent_name}</span>
                              <Badge
                                variant={
                                  run.status === "completed"
                                    ? "default"
                                    : run.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {run.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{run.filename}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {run.query}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(run.started_at), {
                                  addSuffix: true,
                                })}
                              </span>
                              {run.duration_seconds && (
                                <>
                                  <span>•</span>
                                  <span>{run.duration_seconds}s</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer - Fixed side panel */}
      {selectedPdf && (
        <div
          className="fixed top-0 bottom-0 right-0 border-l flex flex-col overflow-hidden bg-background z-10"
          style={{
            width:
              "min(50vw, calc(100vw - var(--sidebar-width, 16rem) - 24rem))",
            minWidth: "400px",
          }}
        >
          <div className="flex items-center justify-between border-b p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
            <h2 className="font-semibold text-lg truncate">
              {selectedPdf.filename}
            </h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedPdf(null)}
              aria-label="Close PDF viewer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <PdfViewer
              fileUrl={`/api/documents/${selectedPdf.documentId}/pdf`}
              fileName={selectedPdf.filename}
              initialPage={selectedPdf.pageNumber}
              className="h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
