"use client";

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent, type KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, FileCode2, UploadCloud, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ALLOWED_MARKDOWN_EXTENSIONS,
  parseMarkdownFile,
  validateMarkdownFile,
  type ParsedMarkdownResult,
} from "./markdownParser";

export interface MarkdownDropzoneProps {
  /** Callback invoked when a Markdown file has been parsed into ContentDoc and metadata */
  onFileParsed: (result: ParsedMarkdownResult) => void;
  /** Optional error handler (in addition to local UI error display) */
  onError?: (error: string) => void;
  className?: string;
}

interface LoadedFileInfo {
  name: string;
  size: number;
  title?: string;
}

export function MarkdownDropzone({ onFileParsed, onError, className }: MarkdownDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<LoadedFileInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleError = useCallback(
    (msg: string) => {
      setErrorMessage(msg);
      onError?.(msg);
    },
    [onError],
  );

  const processFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      const validation = validateMarkdownFile(file);
      if (!validation.valid) {
        handleError(validation.error ?? "Invalid Markdown file.");
        return;
      }

      setIsProcessing(true);
      try {
        const result = await parseMarkdownFile(file);
        setLoadedFile({
          name: result.fileName,
          size: result.fileSize,
          title: result.title,
        });
        onFileParsed(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to parse Markdown file.";
        handleError(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [handleError, onFileParsed],
  );

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      if (files.length > 1) {
        handleError("Please upload only one Markdown file at a time.");
        return;
      }

      void processFile(files[0]);
    },
    [handleError, processFile],
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      // Reset the input value so selecting the same file again triggers change
      e.target.value = "";
      void processFile(files[0]);
    },
    [processFile],
  );

  const handleTriggerClick = useCallback(() => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  }, [isProcessing]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleTriggerClick();
      }
    },
    [handleTriggerClick],
  );

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setLoadedFile(null);
    setErrorMessage(null);
  }, []);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_MARKDOWN_EXTENSIONS.join(",")}
        className="hidden"
        aria-hidden="true"
        onChange={handleFileInputChange}
      />

      {/* When a file is loaded, show a compact file info banner with option to replace or clear */}
      {loadedFile ? (
        <div className="flex items-center justify-between rounded-lg border-[1.5px] border-line bg-card px-4 py-2.5 shadow-card transition-all">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-green-tint text-success">
              <CheckCircle2 size={16} aria-hidden />
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-ink">{loadedFile.name}</span>
                <span className="shrink-0 text-[11px] text-muted">({formatBytes(loadedFile.size)})</span>
              </div>
              <p className="truncate text-[11px] text-secondary">
                {loadedFile.title ? `Title: "${loadedFile.title}"` : "Content successfully populated into editor"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleTriggerClick}
              disabled={isProcessing}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear file info"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted hover:bg-hover hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* Dropzone area */
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload or drag-and-drop a Markdown file (.md, .markdown)"
          onClick={handleTriggerClick}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed p-4 text-center transition-all outline-none",
            isDragging
              ? "border-green-dark bg-green-tint/70 text-ink scale-[1.008] shadow-card"
              : "border-line bg-card/60 hover:border-border-strong hover:bg-card focus-visible:ring-2 focus-visible:ring-green-dark",
            isProcessing && "pointer-events-none opacity-60",
          )}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2.5 py-1 text-[13px] text-secondary">
              <Spinner size={16} />
              <span>Parsing Markdown file…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  isDragging ? "bg-green text-ink" : "bg-surface-subtle text-secondary group-hover:text-ink",
                )}
              >
                {isDragging ? <FileCode2 size={16} aria-hidden /> : <UploadCloud size={16} aria-hidden />}
              </div>
              <div className="text-[12.5px] leading-tight">
                <span className="font-semibold text-ink">
                  {isDragging ? "Drop your Markdown file here" : "Click to upload"}
                </span>{" "}
                <span className="text-secondary">{!isDragging && "or drag & drop a Markdown file"}</span>
              </div>
              <p className="text-[11px] text-muted">Supports .md and .markdown files up to 2 MB</p>
            </div>
          )}
        </div>
      )}

      {/* Inline error feedback if present */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-md border border-color-error-border bg-color-error-bg px-3 py-2 text-[12px] text-error-text"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-error" aria-hidden />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            className="cursor-pointer text-muted hover:text-ink"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
