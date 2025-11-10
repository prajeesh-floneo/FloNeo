import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Copy, Download, X } from "lucide-react";
import { createPortal } from "react-dom";

interface AiSummaryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  fileName?: string;
  metadata?: {
    originalLength?: number;
    summaryLength?: number;
    compressionRatio?: number;
  };
}

export const AiSummaryPopup: React.FC<AiSummaryPopupProps> = ({
  isOpen,
  onClose,
  summary,
  fileName = "document",
  metadata,
}) => {
  const [copied, setCopied] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Initialize portal container on first render
  useEffect(() => {
    console.log("🎨 [AI-SUMMARY-POPUP] Initializing portal container");

    // Create portal container if it doesn't exist
    if (!portalRef.current) {
      let container = document.getElementById("ai-summary-portal");
      if (!container) {
        container = document.createElement("div");
        container.id = "ai-summary-portal";
        document.body.appendChild(container);
        console.log("🎨 [AI-SUMMARY-POPUP] Created new portal container");
      }
      portalRef.current = container as HTMLDivElement;
      setPortalReady(true);
      console.log("🎨 [AI-SUMMARY-POPUP] Portal is now ready");
    }

    return () => {
      console.log("🎨 [AI-SUMMARY-POPUP] Component unmounting");
    };
  }, []);

  // Log when isOpen changes
  useEffect(() => {
    console.log("🎨 [AI-SUMMARY-POPUP] isOpen changed to:", isOpen);
    if (isOpen) {
      console.log(
        "🎨 [AI-SUMMARY-POPUP] Summary preview:",
        summary?.substring(0, 100)
      );
      console.log("🎨 [AI-SUMMARY-POPUP] Portal ready:", portalReady);
    }
  }, [isOpen, summary, portalReady]);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([summary], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${fileName}-summary.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleClose = () => {
    console.log("🎨 [AI-SUMMARY-POPUP] Close button clicked");
    onClose();
  };

  // Don't render if not open or portal not ready
  if (!isOpen || !portalReady) {
    console.log(
      "🎨 [AI-SUMMARY-POPUP] Not rendering - isOpen:",
      isOpen,
      "portalReady:",
      portalReady
    );
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-950 rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h2 className="text-lg font-semibold">AI Summary</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Text */}
          <div className="mb-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Summary of <strong>{fileName}</strong>
              {metadata?.compressionRatio && (
                <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                  {(metadata.compressionRatio * 100).toFixed(1)}% compression
                </span>
              )}
            </p>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {summary}
              </p>
            </div>
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="grid grid-cols-3 gap-3">
              {metadata.originalLength && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Original
                  </div>
                  <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {(metadata.originalLength / 1000).toFixed(1)}K
                  </div>
                </div>
              )}
              {metadata.summaryLength && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Summary
                  </div>
                  <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {(metadata.summaryLength / 1000).toFixed(1)}K
                  </div>
                </div>
              )}
              {metadata.compressionRatio && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                    Compression
                  </div>
                  <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                    {(metadata.compressionRatio * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-6 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleClose}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  // Use portal to render outside the component tree
  return portalRef.current
    ? createPortal(modalContent, portalRef.current)
    : null;
};
