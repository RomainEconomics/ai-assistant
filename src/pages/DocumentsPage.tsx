/**
 * Documents page
 * Displays all uploaded documents and allows new uploads
 */

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Upload, FileText, Trash2, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import type { Document } from "@/types/database";
import { formatDate as formatDateLocale } from "@/lib/i18n";

export function DocumentsPage() {
  const { t } = useTranslation();
  const { data: documents, isLoading, error } = useDocuments();
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  // Check if there are documents being processed (for polling indicator)
  const hasProcessingDocs = documents?.some(
    (doc) => doc.processing_status === 'processing' || doc.processing_status === 'pending'
  );

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportingYear, setReportingYear] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error(t('documents.supportedFormats'));
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error(t('errors.validation'));
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (companyName) formData.append("company_name", companyName);
      if (reportType) formData.append("report_type", reportType);
      if (reportingYear) formData.append("reporting_year", reportingYear);

      const result = await uploadMutation.mutateAsync(formData);

      toast.success(result.message || t('notifications.documentUploaded'));

      // Reset form
      setSelectedFile(null);
      setCompanyName("");
      setReportType("");
      setReportingYear("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast.error(error.message || t('documents.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(t('documents.deleteConfirm'))) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('notifications.documentDeleted'));
    } catch (error: any) {
      toast.error(error.message || t('errors.generic'));
    }
  };

  const getStatusBadge = (status: Document["processing_status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {t('common.success')}
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" className="bg-blue-500">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            {t('documents.processingDocument')}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            {t('common.error')}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            {t('common.loading')}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return formatDateLocale(new Date(dateString), {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('documents.uploadDocument')}</CardTitle>
          <CardDescription>
            {t('documents.dragDrop')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="file">{t('documents.documentType')}</Label>
              <Input
                id="file"
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="company_name">{t('documents.companyName')}</Label>
                <Input
                  id="company_name"
                  placeholder={t('documents.companyName')}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="report_type">{t('documents.reportType')}</Label>
                <Input
                  id="report_type"
                  placeholder={t('documents.reportType')}
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reporting_year">{t('documents.reportingYear')}</Label>
                <Input
                  id="reporting_year"
                  type="number"
                  placeholder="2024"
                  value={reportingYear}
                  onChange={(e) => setReportingYear(e.target.value)}
                  disabled={isUploading}
                />
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="w-full sm:w-auto"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('documents.uploadDocument')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('documents.title')}</CardTitle>
              <CardDescription>
                {t('documents.emptyState')}
              </CardDescription>
            </div>
            {hasProcessingDocs && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Auto-refreshing
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-red-500">
              {t('errors.generic')}: {error.message}
            </div>
          )}

          {documents && documents.length === 0 && (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {t('documents.emptyState')}
              </p>
            </div>
          )}

          {documents && documents.length > 0 && (
            <div className="space-y-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h4 className="font-medium leading-none">{doc.filename}</h4>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span>•</span>
                              <span>{formatDate(doc.created_at)}</span>
                              {doc.company_name && (
                                <>
                                  <span>•</span>
                                  <span>{doc.company_name}</span>
                                </>
                              )}
                              {doc.reporting_year && (
                                <>
                                  <span>•</span>
                                  <span>{doc.reporting_year}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(doc.processing_status)}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(doc.id, doc.filename)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {doc.processing_status === "completed" && (
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            {doc.pages_processed && (
                              <span>{doc.pages_processed} pages</span>
                            )}
                            {doc.chunks_created && (
                              <span>{doc.chunks_created} chunks</span>
                            )}
                          </div>
                        )}

                        {doc.processing_status === "failed" && doc.processing_error && (
                          <p className="text-sm text-red-500">
                            Error: {doc.processing_error}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
