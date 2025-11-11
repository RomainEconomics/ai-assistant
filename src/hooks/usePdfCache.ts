import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '@/lib/api-client';

interface CacheEntry {
  blob: Blob;
  file: File;
  url: string;
  timestamp: number;
}

interface UsePdfCacheOptions {
  maxAge?: number; // in milliseconds, default 30 minutes
  maxSize?: number; // max number of cached PDFs, default 10
}

const defaultOptions: Required<UsePdfCacheOptions> = {
  maxAge: 30 * 60 * 1000, // 30 minutes
  maxSize: 10
};

// Global cache to persist across component unmounts
const pdfCache = new Map<string, CacheEntry>();
const CACHE_VERSION = "v1-s3"; // Update this to invalidate old cache

// Global loading state to prevent duplicate downloads across components
const loadingRequests = new Map<string, Promise<string>>();

// Force clear cache on module load to ensure fresh start
if (typeof window !== 'undefined') {
  console.log('🚀 PDF Cache module loaded, clearing old cache');
  pdfCache.clear();
  loadingRequests.clear();
}

export function usePdfCache(options: UsePdfCacheOptions = {}) {
  const opts = { ...defaultOptions, ...options };

  // Clear any incompatible cache entries on first use
  useEffect(() => {
    const compatibleKeys = Array.from(pdfCache.keys()).filter(key => key.startsWith(CACHE_VERSION));
    if (compatibleKeys.length !== pdfCache.size) {
      console.log('🧹 Clearing incompatible PDF cache entries');
      pdfCache.clear();
    }
  }, []);

  // Clean up expired entries
  const cleanExpiredEntries = useCallback(() => {
    const now = Date.now();
    for (const [key, entry] of pdfCache.entries()) {
      if (now - entry.timestamp > opts.maxAge) {
        URL.revokeObjectURL(entry.url);
        pdfCache.delete(key);
      }
    }
  }, [opts.maxAge]);

  // Enforce cache size limit
  const enforceSizeLimit = useCallback(() => {
    if (pdfCache.size <= opts.maxSize) return;

    // Sort by timestamp and remove oldest entries
    const entries = Array.from(pdfCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const toRemove = entries.slice(0, pdfCache.size - opts.maxSize);
    for (const [key, entry] of toRemove) {
      URL.revokeObjectURL(entry.url);
      pdfCache.delete(key);
    }
  }, [opts.maxSize]);

  // Normalize S3 URL to ensure consistent caching
  const normalizeUrl = useCallback((url: string): string => {
    // Handle relative URLs
    if (url.startsWith('/api/')) {
      const baseUrl = window.location.origin;
      return `${baseUrl}${url}`;
    }
    return url;
  }, []);

  // Get cached PDF or download and cache it
  const getCachedPdf = useCallback(async (
    fileUrl: string
  ): Promise<string> => {
    // Normalize URL for consistent caching
    const normalizedUrl = normalizeUrl(fileUrl);

    // Create cache key from normalized URL and version
    const cacheKey = `${CACHE_VERSION}|${normalizedUrl}`;

    // Clean expired entries first
    cleanExpiredEntries();

    // Return cached version if available
    const cached = pdfCache.get(cacheKey);
    if (cached) {
      console.log('PDF cache hit for:', fileUrl);
      return cached.url;
    }

    // Check if already loading (global check across all components)
    const existingRequest = loadingRequests.get(cacheKey);
    if (existingRequest) {
      console.log('PDF already loading, waiting for existing request:', fileUrl);
      return existingRequest;
    }

    console.log('PDF cache miss, downloading:', normalizedUrl, '(original:', fileUrl, ')');

    // Create a new loading promise
    const loadingPromise = (async () => {
      try {
        // Download the PDF from S3 via our API (with authentication)
        const response = await authenticatedFetch(normalizedUrl);

        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.statusText}`);
        }

        const blob = await response.blob();

        // Create a File object with proper MIME type for better compatibility
        const file = new File([blob], 'document.pdf', {
          type: 'application/pdf',
          lastModified: Date.now()
        });

        const blobUrl = URL.createObjectURL(blob);

        // Cache the result
        const entry: CacheEntry = {
          blob,
          file,
          url: blobUrl,
          timestamp: Date.now()
        };

        pdfCache.set(cacheKey, entry);

        // Enforce size limits
        enforceSizeLimit();

        console.log('PDF cached successfully:', normalizedUrl, '(original:', fileUrl, ')');
        return blobUrl;
      } finally {
        // Remove from loading requests map
        loadingRequests.delete(cacheKey);
      }
    })();

    // Store the promise globally so other components can wait for it
    loadingRequests.set(cacheKey, loadingPromise);

    return loadingPromise;
  }, [cleanExpiredEntries, enforceSizeLimit, normalizeUrl]);

  // Check if a PDF is currently loading
  const isLoading = useCallback((fileUrl: string) => {
    const normalizedUrl = normalizeUrl(fileUrl);
    const cacheKey = `${CACHE_VERSION}|${normalizedUrl}`;
    return loadingRequests.has(cacheKey);
  }, [normalizeUrl]);

  // Check if a PDF is cached
  const isCached = useCallback((fileUrl: string) => {
    const normalizedUrl = normalizeUrl(fileUrl);
    const cacheKey = `${CACHE_VERSION}|${normalizedUrl}`;
    cleanExpiredEntries();
    return pdfCache.has(cacheKey);
  }, [cleanExpiredEntries, normalizeUrl]);

  // Clear cache
  const clearCache = useCallback(() => {
    for (const entry of pdfCache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    pdfCache.clear();
    console.log('PDF cache cleared');
  }, []);

  // Get cache stats
  const getCacheStats = useCallback(() => {
    cleanExpiredEntries();
    return {
      size: pdfCache.size,
      maxSize: opts.maxSize,
      entries: Array.from(pdfCache.keys())
    };
  }, [cleanExpiredEntries, opts.maxSize]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Don't clear cache or loading requests on unmount since they're global
      // They will be cleaned up when requests complete
    };
  }, []);

  // Get cached PDF as File object (more compatible with react-pdf)
  const getCachedPdfFile = useCallback(async (
    fileUrl: string
  ): Promise<File> => {
    // First ensure we have the PDF cached
    await getCachedPdf(fileUrl);

    // Now get the File from cache using normalized URL
    const normalizedUrl = normalizeUrl(fileUrl);
    const cacheKey = `${CACHE_VERSION}|${normalizedUrl}`;
    const cached = pdfCache.get(cacheKey);

    if (!cached) {
      throw new Error('PDF not found in cache after loading');
    }

    return cached.file;
  }, [getCachedPdf, normalizeUrl]);

  return {
    getCachedPdf,
    getCachedPdfFile,
    isLoading,
    isCached,
    clearCache,
    getCacheStats
  };
}
