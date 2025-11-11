/**
 * Multi-Document Chat Page
 * Ask the same question across multiple documents and compare answers
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Loader2,
  Clock,
  Diff,
  Layout,
  List,
  History,
  Trash2,
  Download,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentMultiSelector } from "@/components/DocumentMultiSelector";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { PdfViewer } from "@/components/PdfViewer";
import { authenticatedFetch } from "@/lib/api-client";
import {
  useDocuments,
  useMultiDocQuery,
  useMultiDocHistory,
  useExportMultiDocQuery,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { MultiDocQueryResult } from "@/types/database";
import { formatDistanceToNow } from "date-fns";

type ViewMode = "tabs" | "side-by-side" | "accordion";

export function MultiDocChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: documents } = useDocuments();
  const multiDocQuery = useMultiDocQuery();
  const { data: history, refetch: refetchHistory } = useMultiDocHistory(10);
  const exportMultiDoc = useExportMultiDocQuery();

  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [question, setQuestion] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("tabs");
  const [results, setResults] = useState<MultiDocQueryResult[] | null>(null);
  const [queryQuestion, setQueryQuestion] = useState("");
  const [totalTime, setTotalTime] = useState<number>(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const completedDocs =
    documents?.filter((d) => d.processing_status === "completed") || [];

  const handleSubmit = async () => {
    if (!question.trim()) {
      toast.error(t('errors.validation'));
      return;
    }

    if (selectedDocIds.length === 0) {
      toast.error(t('errors.validation'));
      return;
    }

    try {
      const result = await multiDocQuery.mutateAsync({
        question,
        fileIds: selectedDocIds,
        model: "gpt-4o-mini",
        saveHistory: true,
      });

      setResults(result.results);
      setQueryQuestion(result.question);
      setTotalTime(result.totalTime);
      toast.success(t('common.success'));

      // Refetch history to show the new query
      refetchHistory();
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  const handleLoadHistoryItem = (item: any) => {
    // Restore the query state from history
    setQuestion(item.question);
    setSelectedDocIds(item.documentIds);
    setResults(item.results);
    setQueryQuestion(item.question);

    // Calculate total time from results
    const totalProcessingTime = item.results.reduce(
      (sum: number, r: MultiDocQueryResult) => sum + r.processingTime,
      0,
    );
    setTotalTime(totalProcessingTime);
  };

  const handleDeleteHistoryItem = async (id: number) => {
    try {
      const response = await authenticatedFetch(`/api/rag/multi-doc-history/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t('notifications.conversationDeleted'));
        refetchHistory();
      } else {
        toast.error(t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const handleClear = () => {
    setResults(null);
    setQueryQuestion("");
    setQuestion("");
    setTotalTime(0);
  };

  const handleExport = async (format: 'json' | 'md' | 'docx' | 'pdf') => {
    if (!results || !queryQuestion) {
      toast.error(t('errors.validation'));
      return;
    }

    try {
      await exportMultiDoc.mutateAsync({
        question: queryQuestion,
        results,
        totalTime,
        format,
      });
      toast.success(t('notifications.exportSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto p-6 max-w-[1800px]">
        {/* Header with History Button */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('documents.multiDocChat.title')}</h1>
            <p className="text-muted-foreground">
              {t('documents.multiDocChat.description')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setIsHistoryOpen(true)}
          >
            <History className="w-4 h-4 mr-2" />
            {t('documents.multiDocChat.historyButton')}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Document Selection & Question */}
          <div className="lg:col-span-3 space-y-4 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('documents.multiDocChat.selectDocuments')}</CardTitle>
                <CardDescription>
                  {t('documents.multiDocChat.chooseDocuments')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentMultiSelector
                  documents={completedDocs}
                  selectedIds={selectedDocIds}
                  onSelectionChange={setSelectedDocIds}
                  maxSelection={10}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('documents.multiDocChat.yourQuestion')}</CardTitle>
                <CardDescription>
                  {t('documents.multiDocChat.askAnything')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder={t('documents.multiDocChat.placeholder')}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={6}
                  className="resize-none"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      multiDocQuery.isPending || selectedDocIds.length === 0
                    }
                    className="flex-1"
                  >
                    {multiDocQuery.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('documents.multiDocChat.querying')}
                      </>
                    ) : (
                      <>
                        <Diff className="mr-2 h-4 w-4" />
                        {t('documents.multiDocChat.askAllDocuments')}
                      </>
                    )}
                  </Button>

                  {results && (
                    <Button variant="outline" onClick={handleClear}>
                      {t('documents.multiDocChat.clear')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-9 min-w-0">
            {results ? (
              <Card className="min-w-0">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{t('documents.multiDocChat.results')}</CardTitle>
                      <CardDescription className="whitespace-pre-wrap">
                        {queryQuestion}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {(totalTime / 1000).toFixed(2)}s
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={exportMultiDoc.isPending}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {t('common.export')}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleExport('json')}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('documents.multiDocChat.exportAsJson')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('md')}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('documents.multiDocChat.exportAsMarkdown')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('docx')}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('documents.multiDocChat.exportAsWord')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport('pdf')}>
                            <Download className="h-4 w-4 mr-2" />
                            {t('documents.multiDocChat.exportAsPdf')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* View Mode Selector */}
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-sm text-muted-foreground">{t('documents.multiDocChat.viewModes')}:</span>
                    <Button
                      variant={viewMode === "tabs" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("tabs")}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      {t('documents.multiDocChat.tabs')}
                    </Button>
                    <Button
                      variant={
                        viewMode === "side-by-side" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setViewMode("side-by-side")}
                      disabled={results.length > 3}
                    >
                      <Layout className="h-4 w-4 mr-1" />
                      {t('documents.multiDocChat.sideBySide')}
                    </Button>
                    <Button
                      variant={viewMode === "accordion" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode("accordion")}
                    >
                      <List className="h-4 w-4 mr-1" />
                      {t('documents.multiDocChat.accordion')}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="min-w-0">
                  {/* Tabs View */}
                  {viewMode === "tabs" && (
                    <Tabs
                      defaultValue={results[0]?.fileId.toString()}
                      className="min-w-0"
                    >
                      <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
                        {results.map((result) => (
                          <TabsTrigger
                            key={result.fileId}
                            value={result.fileId.toString()}
                            className="flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            {result.filename.substring(0, 20)}
                            {result.filename.length > 20 && "..."}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {results.map((result) => (
                        <TabsContent
                          key={result.fileId}
                          value={result.fileId.toString()}
                          className="mt-4 min-w-0"
                        >
                          <ResultCard result={result} documents={documents} />
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}

                  {/* Side-by-Side View */}
                  {viewMode === "side-by-side" && (
                    <div
                      className={`grid grid-cols-1 ${
                        results.length === 2
                          ? "md:grid-cols-2"
                          : "md:grid-cols-3"
                      } gap-4`}
                    >
                      {results.slice(0, 3).map((result) => (
                        <div key={result.fileId}>
                          <ResultCard
                            result={result}
                            documents={documents}
                            compact
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Accordion View */}
                  {viewMode === "accordion" && (
                    <Accordion
                      type="single"
                      collapsible
                      defaultValue={results[0]?.fileId.toString()}
                    >
                      {results.map((result) => (
                        <AccordionItem
                          key={result.fileId}
                          value={result.fileId.toString()}
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span className="font-medium">
                                {result.filename}
                              </span>
                              <Badge variant="secondary" className="ml-2">
                                {(result.processingTime / 1000).toFixed(2)}s
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <ResultCard result={result} documents={documents} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Diff className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">{t('documents.multiDocChat.results')}</h3>
                  <p className="text-muted-foreground max-w-md">
                    {t('documents.multiDocChat.noResults')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('documents.multiDocChat.historyButton')}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {history && history.length > 0 ? (
              <div className="space-y-3 pr-4">
                {history.map((item: any) => (
                  <Card key={item.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className="flex-1"
                          onClick={() => {
                            handleLoadHistoryItem(item);
                            setIsHistoryOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {item.documentIds.length} {t('documents.multiDocChat.documents')}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </div>
                          <div className="text-sm line-clamp-3">
                            {item.question}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistoryItem(item.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  {t('documents.multiDocChat.noHistory')}
                </p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ResultCardProps {
  result: MultiDocQueryResult;
  documents?: any[];
  compact?: boolean;
}

function ResultCard({ result, documents, compact = false }: ResultCardProps) {
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<number>(1);

  // Find the document data for the PDF URL
  const document = documents?.find((doc) => doc.id === result.fileId);

  const handleSourceClick = (page: number) => {
    setSelectedPage(page);
    setIsPdfModalOpen(true);
  };

  return (
    <>
      <div className="space-y-4 min-w-0 max-w-full overflow-x-hidden">
        <div className="flex items-start justify-between min-w-0">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1 break-words">
              {result.filename}
            </h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {result.sources.length} sources
              </Badge>
              <span>•</span>
              <span>{(result.processingTime / 1000).toFixed(2)}s</span>
            </div>
          </div>
        </div>

        <ScrollArea className={compact ? "h-[500px]" : "h-auto max-h-[700px]"}>
          <div className="pr-4 min-w-0 max-w-full">
            <MarkdownMessage content={result.answer} />
          </div>

          {result.sources.length > 0 && (
            <div className="mt-6 pt-4 border-t pr-4 min-w-0 max-w-full">
              <h5 className="font-semibold text-sm mb-3">Sources</h5>
              <div className="space-y-3 min-w-0 max-w-full">
                {result.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-muted/50 p-3 rounded-md hover:bg-muted/70 transition-colors cursor-pointer min-w-0 max-w-full"
                    onClick={() => handleSourceClick(source.page)}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="text-xs flex-shrink-0"
                      >
                        Page {source.page}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Click to view PDF
                      </span>
                    </div>
                    <p
                      className="text-muted-foreground break-all overflow-hidden max-w-full"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* PDF Modal */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="!max-w-[85vw] w-[85vw] !max-h-[90vh] h-[90vh] p-0 sm:!max-w-[85vw]">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{result.filename}</DialogTitle>
          </DialogHeader>
          <div className="h-[calc(100%-4rem)] overflow-hidden">
            {document ? (
              <PdfViewer
                fileUrl={`/api/documents/${document.id}/pdf`}
                fileName={result.filename}
                initialPage={selectedPage}
                className="h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">PDF not available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
