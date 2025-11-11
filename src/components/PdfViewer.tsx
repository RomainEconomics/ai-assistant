import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { usePdfCache } from "@/hooks/usePdfCache";

// Configure PDF.js worker to use local file
pdfjs.GlobalWorkerOptions.workerSrc = '/public/pdf.worker.min.mjs';

interface PdfViewerProps {
  fileUrl: string;
  fileName?: string;
  initialPage?: number;
  className?: string;
}

export function PdfViewer({
  fileUrl,
  fileName,
  initialPage = 1,
  className = "",
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cachedPdfFile, setCachedPdfFile] = useState<File | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enhanced PDF caching with global configuration
  const { getCachedPdfFile, isLoading: isCacheLoading, isCached } = usePdfCache({
    maxAge: 60 * 60 * 1000, // 1 hour cache
    maxSize: 20 // Larger cache size for better cross-page performance
  });

  // Function to handle document loading success
  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    console.log("PdfViewer: Document loaded successfully, numPages:", numPages);
    setNumPages(numPages);
    setIsLoading(false);
  }

  // Change page functions
  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages || 1, prev + 1));
  };

  const goToPage = (pageNum: number) => {
    const page = Math.max(1, Math.min(pageNum, numPages || 1));
    setPageNumber(page);
  };

  // Zoom functions
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.6));
  const resetZoom = () => setScale(1.2);

  // Handle error
  const onDocumentLoadError = (error: any) => {
    console.error("PdfViewer: Failed to load PDF document:", error);
    console.error("PdfViewer: Error details:", {
      message: error?.message,
      name: error?.name,
      fileUrl,
    });
    setError("Failed to load the PDF document. Please try again later.");
    setIsLoading(false);
  };

  // Load cached PDF when fileUrl changes
  useEffect(() => {
    let isMounted = true;

    const loadPdf = async () => {
      if (!fileUrl) return;

      setIsLoading(true);
      setError(null);
      setCachedPdfFile(null);

      try {
        const cachedFile = await getCachedPdfFile(fileUrl);
        if (isMounted) {
          setCachedPdfFile(cachedFile);
          console.log("PdfViewer: Using cached PDF File, size:", cachedFile.size, "name:", cachedFile.name);
        }
      } catch (err) {
        if (isMounted) {
          console.error("PdfViewer: Failed to load cached PDF:", err);
          setError("Failed to load the PDF document. Please try again later.");
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [fileUrl, getCachedPdfFile]);

  // Go to initial page when component mounts or initialPage changes
  useEffect(() => {
    if (initialPage && initialPage !== pageNumber && numPages) {
      setPageNumber(Math.max(1, Math.min(initialPage, numPages)));
    }
  }, [initialPage, numPages]);

  // Memoize the file object to prevent unnecessary reloads
  const memoizedFileObject = useMemo(() => {
    return cachedPdfFile;
  }, [cachedPdfFile]);

  return (
    <div className={`bg-background flex h-full flex-col ${className}`}>
      {/* Toolbar */}
      <div className="bg-muted/40 flex items-center justify-between border-b p-3">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center space-x-2">
            <Input
              type="number"
              value={pageNumber}
              onChange={(e) => goToPage(Number.parseInt(e.target.value, 10))}
              className="w-16 text-center"
              min={1}
              max={numPages || 1}
            />
            <span className="text-muted-foreground text-sm">of {numPages || 0}</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {fileName && (
          <div className="text-muted-foreground hidden text-sm font-medium md:block">
            {fileName}
            {process.env.NODE_ENV === 'development' && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                isCached(fileUrl) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {isCached(fileUrl) ? 'Cached' : 'Not cached'}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={resetZoom} className="min-w-[60px]">
            {Math.round(scale * 100)}%
          </Button>

          <Button variant="ghost" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div
        ref={containerRef}
        className="bg-muted/20 flex flex-1 justify-center overflow-auto p-4"
      >
        {(isLoading || !cachedPdfFile) && !error && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="border-primary mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
              <p className="text-muted-foreground">
                {isCached(fileUrl) ? "Loading cached PDF..." : "Downloading and caching PDF..."}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex h-full items-center justify-center">
            <div className="bg-background max-w-md rounded-lg border p-6 text-center shadow-sm">
              <div className="text-destructive mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold">Error Loading PDF</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
            </div>
          </div>
        )}

        <div className="flex justify-center max-w-full">
          {memoizedFileObject && (
            <Document
              file={memoizedFileObject}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
            >
              {!isLoading && !error && (
                <div className="flex justify-center max-w-full overflow-hidden">
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="max-w-full h-auto"
                  />
                </div>
              )}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
