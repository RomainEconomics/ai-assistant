/**
 * Batch Questioning Page
 * Ask multiple questions to a single document
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Loader2,
  Clock,
  List,
  History,
  Trash2,
  Plus,
  X,
  Send,
  Download,
  BookmarkPlus,
  ChevronDown,
  Library,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { PdfViewer } from "@/components/PdfViewer";
import {
  useDocuments,
  useBatchQuestioning,
  useBatchQuestioningHistory,
  useExportBatchQuestioning,
  useQuestionTemplates,
  useQuestionTemplateCategories,
  useCreateQuestionTemplate,
  useDeleteQuestionTemplate,
} from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch } from "@/lib/api-client";
import { toast } from "sonner";
import type { BatchQuestionResult } from "@/types/database";
import { formatDistanceToNow } from "date-fns";

export function BatchQuestioningPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: documents } = useDocuments();
  const batchQuestioning = useBatchQuestioning();
  const { data: history, refetch: refetchHistory } = useBatchQuestioningHistory(10);
  const exportBatchQuestioning = useExportBatchQuestioning();

  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<string[]>([""]);
  const [results, setResults] = useState<BatchQuestionResult[] | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [totalTime, setTotalTime] = useState<number>(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const { data: templates } = useQuestionTemplates(selectedCategory);
  const { data: categories } = useQuestionTemplateCategories();
  const createTemplate = useCreateQuestionTemplate();
  const deleteTemplate = useDeleteQuestionTemplate();

  const completedDocs =
    documents?.filter((d) => d.processing_status === "completed") || [];

  const handleAddQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = async () => {
    // Filter out empty questions
    const validQuestions = questions.filter((q) => q.trim() !== "");

    if (validQuestions.length === 0) {
      toast.error(t('batchQuestioning.errors.noQuestions'));
      return;
    }

    if (!selectedDocId) {
      toast.error(t('batchQuestioning.errors.noDocument'));
      return;
    }

    try {
      const result = await batchQuestioning.mutateAsync({
        questions: validQuestions,
        fileId: selectedDocId,
        model: "gpt-4o-mini",
        saveHistory: true,
      });

      setResults(result.results);
      setSelectedFileName(result.filename);
      setTotalTime(result.totalTime);
      toast.success(t('batchQuestioning.notifications.success'));

      // Refetch history to show the new query
      refetchHistory();
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  const handleLoadHistoryItem = (item: any) => {
    // Restore the query state from history
    setSelectedDocId(item.fileId);
    setQuestions(item.questions);
    setResults(item.results);
    setSelectedFileName(item.filename);

    // Calculate total time from results
    const totalProcessingTime = item.results.reduce(
      (sum: number, r: BatchQuestionResult) => sum + r.processingTime,
      0,
    );
    setTotalTime(totalProcessingTime);
  };

  const handleDeleteHistoryItem = async (id: number) => {
    try {
      const response = await authenticatedFetch(`/api/batch-questioning/history/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t('batchQuestioning.notifications.historyDeleted'));
        refetchHistory();
      } else {
        toast.error(t('errors.generic'));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const handleSourceClick = (page: number) => {
    setSelectedPage(page);
    setIsPdfModalOpen(true);
  };

  const handleExport = async (format: 'json' | 'md' | 'docx' | 'pdf') => {
    if (!results || !selectedDocId || !selectedFileName) {
      toast.error(t('errors.validation'));
      return;
    }

    try {
      await exportBatchQuestioning.mutateAsync({
        filename: selectedFileName,
        fileId: selectedDocId,
        results,
        totalTime,
        format,
      });
      toast.success(t('notifications.exportSuccess'));
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  const handleAddTemplateQuestion = (questionText: string) => {
    // Add the template question to the questions list
    // If there's an empty question at the end, replace it
    const lastQuestion = questions[questions.length - 1];
    if (lastQuestion === "") {
      const newQuestions = [...questions];
      newQuestions[newQuestions.length - 1] = questionText;
      setQuestions(newQuestions);
    } else {
      setQuestions([...questions, questionText]);
    }
    toast.success(t('batchQuestioning.notifications.templateAdded'));
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success(t('batchQuestioning.notifications.templateDeleted'));
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  // Get the selected document for PDF viewer
  const selectedDocument = selectedDocId
    ? documents?.find((doc) => doc.id === selectedDocId)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('batchQuestioning.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('batchQuestioning.description')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsHistoryOpen(true)}
        >
          <History className="w-4 h-4 mr-2" />
          {t('batchQuestioning.historyButton')}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('batchQuestioning.setup.title')}</CardTitle>
              <CardDescription>
                {t('batchQuestioning.setup.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Document Selector */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t('batchQuestioning.selectDocument')}
                </label>
                <Select
                  value={selectedDocId?.toString() || ""}
                  onValueChange={(value) => setSelectedDocId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('batchQuestioning.selectDocumentPlaceholder')} />
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
              </div>

              {/* Questions List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    {t('batchQuestioning.questions')} ({questions.length})
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTemplatesOpen(true)}
                    >
                      <Library className="w-4 h-4 mr-2" />
                      {t('batchQuestioning.templates.browse')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddQuestion}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('batchQuestioning.addQuestion')}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder={`${t('batchQuestioning.questionPlaceholder')} ${index + 1}`}
                          value={question}
                          onChange={(e) => handleQuestionChange(index, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (index === questions.length - 1) {
                                handleAddQuestion();
                              }
                            }
                          }}
                        />
                      </div>
                      {questions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveQuestion(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={batchQuestioning.isPending || !selectedDocId}
                className="w-full"
                size="lg"
              >
                {batchQuestioning.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('batchQuestioning.processing')}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    {t('batchQuestioning.submit')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          {results && results.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('batchQuestioning.results.title')}</CardTitle>
                    <CardDescription>
                      {selectedFileName} • {results.length} {t('batchQuestioning.results.questionsAnswered')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(totalTime / 1000).toFixed(1)}s
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exportBatchQuestioning.isPending}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {t('common.export')}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport('json')}>
                          <Download className="h-4 w-4 mr-2" />
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('md')}>
                          <Download className="h-4 w-4 mr-2" />
                          Export as Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('docx')}>
                          <Download className="h-4 w-4 mr-2" />
                          Export as Word
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('pdf')}>
                          <Download className="h-4 w-4 mr-2" />
                          Export as PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {results.map((result, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-start gap-3 text-left">
                          <Badge variant="outline">{index + 1}</Badge>
                          <span className="font-medium">{result.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2">
                          {/* Answer */}
                          <div className="bg-muted/50 rounded-lg p-4">
                            <MarkdownMessage content={result.answer} />
                          </div>

                          {/* Sources */}
                          {result.sources.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <List className="w-4 h-4" />
                                {t('batchQuestioning.results.sources')} ({result.sources.length})
                              </h4>
                              <div className="space-y-2">
                                {result.sources.map((source, sourceIdx) => (
                                  <div
                                    key={sourceIdx}
                                    className="text-xs bg-background border rounded p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSourceClick(source.page)}
                                  >
                                    <div className="font-medium mb-1 text-primary flex items-center gap-1">
                                      <FileText className="w-3 h-3" />
                                      {t('batchQuestioning.results.page')} {source.page}
                                    </div>
                                    <div className="text-muted-foreground line-clamp-3">
                                      {source.content}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Processing Time */}
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('batchQuestioning.results.processingTime')}: {(result.processingTime / 1000).toFixed(2)}s
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!results && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {t('batchQuestioning.emptyState.title')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t('batchQuestioning.emptyState.description')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('batchQuestioning.historyButton')}</DialogTitle>
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
                            <span className="font-medium text-sm">{item.filename}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {item.questions.length} {t('batchQuestioning.history.questions')} •{" "}
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {item.questions.slice(0, 3).join(" • ")}
                            {item.questions.length > 3 && "..."}
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
                  {t('batchQuestioning.history.empty')}
                </p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="!max-w-[85vw] w-[85vw] !max-h-[90vh] h-[90vh] p-0 sm:!max-w-[85vw]">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{selectedFileName}</DialogTitle>
          </DialogHeader>
          <div className="h-[calc(100%-4rem)] overflow-hidden">
            {selectedDocument ? (
              <PdfViewer
                fileUrl={`/api/documents/${selectedDocument.id}/pdf`}
                fileName={selectedFileName}
                initialPage={selectedPage}
                className="h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t('errors.documentNotFound')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Templates Dialog */}
      <Dialog open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="w-5 h-5" />
              {t('batchQuestioning.templates.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{t('batchQuestioning.templates.category')}:</label>
              <Select
                value={selectedCategory || "all"}
                onValueChange={(value) => setSelectedCategory(value === "all" ? undefined : value)}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('batchQuestioning.templates.allCategories')}</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Templates List */}
            <ScrollArea className="h-[70vh]">
              {templates && templates.length > 0 ? (
                <div className="space-y-3 pr-4">
                  {/* Group by category */}
                  {Object.entries(
                    templates.reduce((acc, template) => {
                      const cat = template.category;
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat].push(template);
                      return acc;
                    }, {} as Record<string, typeof templates>)
                  ).map(([category, categoryTemplates]) => (
                    <div key={category} className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground px-2">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {categoryTemplates.map((template) => (
                          <div
                            key={template.id}
                            className="group flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-medium text-sm">{template.title}</span>
                                {template.is_global && (
                                  <Badge variant="secondary" className="text-xs py-0 px-1.5">
                                    {t('batchQuestioning.templates.global')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {template.question_text}
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  handleAddTemplateQuestion(template.question_text);
                                }}
                                title={t('batchQuestioning.templates.addButton')}
                              >
                                <PlusCircle className="w-4 h-4" />
                              </Button>
                              {!template.is_global && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Library className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {t('batchQuestioning.templates.empty')}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
