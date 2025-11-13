/**
 * Multi-select document picker component
 * Allows users to select multiple documents with checkboxes
 */
import { useState, useMemo } from "react";
import { Search, FileText, CheckSquare, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Document } from "@/types/database";

interface DocumentMultiSelectorProps {
  documents: Document[];
  selectedIds: number[];
  onSelectionChange: (selectedIds: number[]) => void;
  maxSelection?: number;
  showStats?: boolean;
}

export function DocumentMultiSelector({
  documents,
  selectedIds,
  onSelectionChange,
  maxSelection,
  showStats = true,
}: DocumentMultiSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter documents based on search
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents;
    }

    const query = searchQuery.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.filename.toLowerCase().includes(query) ||
        doc.company_name?.toLowerCase().includes(query) ||
        doc.report_type?.toLowerCase().includes(query),
    );
  }, [documents, searchQuery]);

  const handleToggle = (docId: number) => {
    if (selectedIds.includes(docId)) {
      // Deselect
      onSelectionChange(selectedIds.filter((id) => id !== docId));
    } else {
      // Select (check max limit)
      if (maxSelection && selectedIds.length >= maxSelection) {
        return; // Max selection reached
      }
      onSelectionChange([...selectedIds, docId]);
    }
  };

  const handleSelectAll = () => {
    const allIds = filteredDocuments.map((doc) => doc.id);
    const limitedIds = maxSelection ? allIds.slice(0, maxSelection) : allIds;
    onSelectionChange(limitedIds);
  };

  const handleClearAll = () => {
    onSelectionChange([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search and Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={filteredDocuments.length === 0}
        >
          Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={selectedIds.length === 0}
        >
          Clear
        </Button>
      </div>

      {/* Selection Stats */}
      {showStats && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {selectedIds.length} of {documents.length} selected
          </span>
          {maxSelection && (
            <Badge variant="secondary">Max: {maxSelection}</Badge>
          )}
        </div>
      )}

      {/* Document List */}
      <ScrollArea className="h-[400px] rounded-md border">
        <div className="p-4 pr-3 space-y-2">
          {filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mb-2 opacity-50" />
              <p>
                {searchQuery
                  ? "No documents match your search"
                  : "No documents available"}
              </p>
            </div>
          ) : (
            filteredDocuments.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);
              const isMaxReached = maxSelection
                ? selectedIds.length >= maxSelection && !isSelected
                : false;

              return (
                <div
                  key={doc.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent ${
                    isSelected ? "bg-accent border-primary" : ""
                  } ${isMaxReached ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => !isMaxReached && handleToggle(doc.id)}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span
                        className="font-medium text-sm truncate"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground mt-2">
                      {doc.company_name && (
                        <span
                          className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium overflow-hidden max-w-[120px]"
                          title={doc.company_name}
                        >
                          <span className="truncate">{doc.company_name}</span>
                        </span>
                      )}
                      {doc.report_type && (
                        <span
                          className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium"
                          title={doc.report_type}
                        >
                          {doc.report_type}
                        </span>
                      )}
                      {doc.reporting_year && (
                        <span className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium">
                          {doc.reporting_year}
                        </span>
                      )}
                      <span className="text-xs">
                        {formatFileSize(doc.file_size)}
                      </span>
                      {doc.pages_processed && (
                        <span className="text-xs">
                          {doc.pages_processed} pages
                        </span>
                      )}
                    </div>

                    {doc.processing_status !== "completed" && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        {doc.processing_status}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
