/**
 * Document Selector Dialog
 * Allows selecting a document to attach to a conversation
 * RAG will automatically find relevant pages when the user asks questions
 */

import { useState } from "react";
import { useDocuments, useAddDocumentToConversation } from "@/hooks/useApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface DocumentSelectorProps {
  conversationId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocumentSelector({ conversationId, open, onOpenChange }: DocumentSelectorProps) {
  const { data: documents, isLoading } = useDocuments();
  const addDocumentMutation = useAddDocumentToConversation();

  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  const completedDocuments = documents?.filter((doc) => doc.processing_status === "completed") || [];

  const handleAdd = async () => {
    if (!selectedDocumentId) {
      toast.error("Please select a document");
      return;
    }

    try {
      await addDocumentMutation.mutateAsync({
        conversationId,
        documentId: selectedDocumentId,
      });

      toast.success("Document added - RAG will find relevant pages automatically");
      onOpenChange(false);
      setSelectedDocumentId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to add document");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedDocumentId(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Document to Conversation</DialogTitle>
          <DialogDescription>
            Select a document to enable for this conversation. Relevant pages will be automatically retrieved using RAG (Retrieval-Augmented Generation) when you ask questions.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : completedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No processed documents available.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload and process a document first.
            </p>
          </div>
        ) : (
          <div>
            <ScrollArea className="max-h-[400px] border rounded-md">
              <div className="p-2 space-y-1">
                {completedDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocumentId(doc.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedDocumentId === doc.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium">{doc.filename}</div>
                    <div className="text-xs opacity-70 mt-0.5">
                      {doc.pages_processed} pages • {doc.chunks_created} chunks
                      {doc.company_name && ` • ${doc.company_name}`}
                      {doc.reporting_year && ` • ${doc.reporting_year}`}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedDocumentId || addDocumentMutation.isPending}
          >
            {addDocumentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Document"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
