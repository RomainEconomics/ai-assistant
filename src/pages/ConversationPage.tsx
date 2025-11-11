import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Send,
  Loader2,
  Bot,
  Edit2,
  Check,
  X,
  FileText,
  Plus,
  Download,
  Upload,
  MoreVertical,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api-client";
import {
  useConversation,
  useUpdateMessage,
  useDeleteMessage,
  useConversationDocuments,
  useRemoveDocumentFromConversation,
  useExportConversation,
  useImportConversation,
} from "@/hooks/useApi";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { MessageActions } from "../components/MessageActions";
import { DocumentSelector } from "../components/DocumentSelector";
import { PdfViewer } from "../components/PdfViewer";
import { toast } from "sonner";
import type { Message } from "@/types/database";

interface ConversationPageProps {
  conversationId: number;
  onBack: () => void;
}

export function ConversationPage({
  conversationId,
  onBack,
}: ConversationPageProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<{
    documentId: number;
    filename: string;
    pageNumber: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useConversation(conversationId);
  const updateMessage = useUpdateMessage();
  const deleteMessage = useDeleteMessage();
  const { data: conversationDocuments } =
    useConversationDocuments(conversationId);
  const removeDocumentMutation = useRemoveDocumentFromConversation();
  const exportConversation = useExportConversation();
  const importConversation = useImportConversation();

  const updateTitle = useMutation({
    mutationFn: async (title: string) => {
      const res = await authenticatedFetch(`/api/conversations/${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to update title");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast.success(t('notifications.conversationUpdated'));
    },
    onError: () => {
      toast.error(t('errors.generic'));
    },
  });

  // Update local messages when data changes
  useEffect(() => {
    if (data?.messages) {
      setLocalMessages(data.messages);
    }
  }, [data?.messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingMessage]);

  const handleSend = async () => {
    if (!input.trim() || !data || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: Date.now(),
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, tempUserMessage]);

    try {
      // Call the streaming API with authentication
      const response = await authenticatedFetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userMessage,
          model_provider: data.conversation.model_provider,
          model_name: data.conversation.model_name,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Text chunk from AI SDK stream
              try {
                const content = JSON.parse(line.substring(2));
                if (typeof content === "string") {
                  accumulatedText += content;
                  setStreamingMessage(accumulatedText);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // The assistant message is now saved automatically on the backend
      // Just add it to local state and refetch
      if (accumulatedText) {
        const tempAssistantMessage: Message = {
          id: Date.now() + 1,
          conversation_id: conversationId,
          role: "assistant",
          content: accumulatedText,
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, tempAssistantMessage]);
      }

      setStreamingMessage("");
      // Refetch to get the saved message with proper ID from database
      refetch();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(t('chat.error'));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleEditMessage = (messageId: number, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };

  const handleSaveEdit = async (messageId: number) => {
    if (!editContent.trim()) {
      toast.error(t('errors.validation'));
      return;
    }

    try {
      await updateMessage.mutateAsync({
        id: messageId,
        content: editContent,
        conversationId,
      });
      setEditingMessageId(null);
      setEditContent("");
      toast.success(t('notifications.conversationUpdated'));
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm(t('chat.deleteMessage') + '?')) return;

    try {
      await deleteMessage.mutateAsync({ id: messageId, conversationId });
      toast.success(t('notifications.conversationUpdated'));
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const handleRegenerateResponse = async (messageId: number) => {
    // Find the user message before this assistant message
    const messageIndex = localMessages.findIndex((m) => m.id === messageId);
    if (messageIndex <= 0) return;

    const userMessage = localMessages[messageIndex - 1];
    if (userMessage.role !== "user") return;

    // Delete the current assistant message
    await handleDeleteMessage(messageId);

    // Re-send the user message
    setInput(userMessage.content);
    setTimeout(() => handleSend(), 100);
  };

  const handleRemoveDocument = async (documentId: number) => {
    try {
      await removeDocumentMutation.mutateAsync({ conversationId, documentId });
      toast.success(t('notifications.documentDeleted'));
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenPdf = (
    documentId: number,
    filename: string,
    pageNumber: number = 1,
  ) => {
    setSelectedPdf({ documentId, filename, pageNumber });
  };

  const handleExport = async (format: 'json' | 'md' | 'docx' | 'pdf') => {
    try {
      await exportConversation.mutateAsync({ conversationId, format });
      toast.success(t('notifications.conversationUpdated'));
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  const handleImport = async () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();

        // Import requires projectId - get it from current conversation
        if (!data?.conversation.project_id) {
          toast.error(t('errors.generic'));
          return;
        }

        await importConversation.mutateAsync({
          projectId: data.conversation.project_id,
          jsonData: text,
        });

        toast.success(t('notifications.conversationUpdated'));
        // Refresh the conversation list
        refetch();
      } catch (error: any) {
        toast.error(error.message || t('errors.generic'));
      }
    };
    input.click();
  };

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat Section */}
      <div
        className={`flex flex-col flex-1 overflow-hidden ${selectedPdf ? "pr-[min(50vw,calc(100vw-var(--sidebar-width,16rem)-24rem))]" : ""}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="h-8 text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateTitle.mutate(titleInput);
                        setIsEditingTitle(false);
                      }
                      if (e.key === "Escape") {
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      updateTitle.mutate(titleInput);
                      setIsEditingTitle(false);
                    }}
                    disabled={updateTitle.isPending}
                  >
                    {updateTitle.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setIsEditingTitle(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="font-semibold text-lg">
                    {data.conversation.title}
                  </h1>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setTitleInput(data.conversation.title);
                      setIsEditingTitle(true);
                    }}
                    aria-label="Edit title"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {data.conversation.model_provider === "openai"
                    ? t('models.openai')
                    : t('models.anthropic')}
                </Badge>
                <span>{data.conversation.model_name}</span>
              </div>
            </div>
          </div>

          {/* Export/Import Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <Download className="h-4 w-4 mr-2" />
                {t('chat.exportAsJson')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('md')}>
                <Download className="h-4 w-4 mr-2" />
                {t('chat.exportAsMarkdown')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>
                <Download className="h-4 w-4 mr-2" />
                {t('chat.exportAsWord')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <Download className="h-4 w-4 mr-2" />
                {t('chat.exportAsPdf')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                {t('chat.importConversation')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Attached Documents */}
        {conversationDocuments && conversationDocuments.length > 0 && (
          <div className="border-b px-4 py-3 bg-muted/30">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    RAG-Enabled Documents
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Auto-retrieval
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDocumentSelector(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Document
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {conversationDocuments.map((doc) => (
                  <Badge
                    key={doc.document_id}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 gap-2"
                  >
                    <span className="text-xs">{doc.document_filename}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => handleRemoveDocument(doc.document_id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Relevant pages will be automatically retrieved when you ask
                questions
              </p>
            </div>
          </div>
        )}

        {/* Add Document Button (when no documents attached) */}
        {(!conversationDocuments || conversationDocuments.length === 0) && (
          <div className="border-b px-4 py-2 bg-muted/20">
            <div className="mx-auto max-w-5xl">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDocumentSelector(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Enable RAG with Documents
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="mx-auto max-w-5xl space-y-1">
            {localMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <Bot className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="font-semibold text-lg mb-2">
                  Start a conversation
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Send a message to begin your conversation with{" "}
                  {data.conversation.model_provider === "openai"
                    ? "GPT"
                    : "Claude"}
                </p>
              </div>
            ) : (
              <>
                {localMessages.map((message, index) => (
                  <div key={message.id}>
                    {index > 0 && <Separator className="my-6" />}
                    <div className="group py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                            {message.role === "user" ? "User" : "Assistant"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.created_at).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        </div>
                        <MessageActions
                          messageId={message.id}
                          role={message.role}
                          content={message.content}
                          onEdit={() =>
                            handleEditMessage(message.id, message.content)
                          }
                          onDelete={() => handleDeleteMessage(message.id)}
                          onRegenerate={
                            message.role === "assistant"
                              ? () => handleRegenerateResponse(message.id)
                              : undefined
                          }
                        />
                      </div>

                      {editingMessageId === message.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[100px]"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(message.id)}
                              disabled={updateMessage.isPending}
                            >
                              {updateMessage.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full">
                          {message.role === "assistant" ? (
                            <>
                              <MarkdownMessage content={message.content} />
                              {(message as any).sources &&
                                (message as any).sources.length > 0 && (
                                  <div className="mt-3 pt-3 border-t">
                                    <div className="flex items-start gap-2">
                                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                      <div className="flex-1">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          Sources:
                                        </span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                          {(message as any).sources.map(
                                            (source: any, idx: number) => (
                                              <div
                                                key={idx}
                                                className="flex items-center gap-1.5 flex-wrap"
                                              >
                                                <Badge
                                                  variant="outline"
                                                  className="text-xs"
                                                >
                                                  {source.document_filename}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                  pages:
                                                </span>
                                                {source.page_numbers.map(
                                                  (
                                                    pageNum: number,
                                                    pageIdx: number,
                                                  ) => (
                                                    <Badge
                                                      key={pageIdx}
                                                      variant="secondary"
                                                      className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                                      onClick={() =>
                                                        handleOpenPdf(
                                                          source.document_id,
                                                          source.document_filename,
                                                          pageNum,
                                                        )
                                                      }
                                                    >
                                                      {pageNum}
                                                    </Badge>
                                                  ),
                                                )}
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                            </>
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                {message.content}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {streamingMessage && (
                  <div>
                    <Separator className="my-6" />
                    <div className="py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                          Assistant
                        </span>
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </div>
                      <div className="w-full">
                        <MarkdownMessage content={streamingMessage} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-5xl">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.typePlaceholder')}
                className="min-h-[60px] max-h-[200px] resize-none"
                disabled={isStreaming}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="h-[60px] w-[60px] flex-shrink-0"
              >
                {isStreaming ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Document Selector Dialog */}
        <DocumentSelector
          conversationId={conversationId}
          open={showDocumentSelector}
          onOpenChange={setShowDocumentSelector}
        />
      </div>

      {/* PDF Viewer Section - Fixed overlay */}
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
