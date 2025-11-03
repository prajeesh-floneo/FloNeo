"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CanvasRenderer } from "@/components/canvas/CanvasRenderer";
import { CanvasElement } from "@/components/canvas/ElementManager";
import {
  getPreviewSnapshot,
  PreviewSnapshot,
  PreviewPage as PreviewPageType,
} from "@/lib/utils";
import { mapPageStyle, getPageStyleHash } from "@/runtime/pageStyle";

// Force no caching
export const dynamic = "force-dynamic";

interface PreviewContentProps {
  appId: string;
  pageId?: string;
}

function PreviewContent({ appId, pageId }: PreviewContentProps) {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preview data
  useEffect(() => {
    const loadPreviewData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("🎥 PREVIEW: Loading snapshot for appId:", appId);
        const previewSnapshot = await getPreviewSnapshot(appId);

        setSnapshot(previewSnapshot);

        // Set current page - use provided pageId or default to first page
        const targetPageId =
          pageId ||
          previewSnapshot.currentPageId ||
          previewSnapshot.pages[0]?.id;
        setCurrentPageId(targetPageId);

        // Instrumentation for runtime
        const currentPage =
          previewSnapshot.pages.find((p) => p.id === targetPageId) ||
          previewSnapshot.pages[0];
        console.info(
          "[run] page",
          targetPageId,
          "elements",
          currentPage.elements?.length || 0,
          "canvas",
          currentPage.canvasWidth || 960,
          currentPage.canvasHeight || 640
        );

        console.log("🎥 PREVIEW: Loaded successfully", {
          appId,
          pagesCount: previewSnapshot.pages.length,
          currentPageId: targetPageId,
          totalElements: previewSnapshot.pages.reduce(
            (sum, page) => sum + page.elements.length,
            0
          ),
          canvasSize: `${previewSnapshot.canvas.width}x${previewSnapshot.canvas.height}`,
          canvasBackground: previewSnapshot.canvas.backgroundColor,
          firstPageElements: previewSnapshot.pages[0]?.elements
            .slice(0, 3)
            .map((el) => ({
              id: el.id,
              type: el.type,
              x: el.x,
              y: el.y,
              w: el.width,
              h: el.height,
            })),
        });
      } catch (err) {
        console.error("❌ PREVIEW: Failed to load preview data", err);
        setError(err instanceof Error ? err.message : "Failed to load preview");
      } finally {
        setLoading(false);
      }
    };

    loadPreviewData();
  }, [appId, pageId]);

  // Handle page navigation
  const navigateToPage = (targetPageId: string) => {
    setCurrentPageId(targetPageId);

    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set("pageId", targetPageId);
    window.history.pushState({}, "", url.toString());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand-blue)] mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Loading preview...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            App ID: {appId}
          </p>
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-red-200 dark:border-red-900">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-[var(--brand-pink)] mb-4">
            Preview Error
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {error || "Failed to load preview data"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[var(--brand-blue)] text-white dark:text-white rounded hover:bg-[var(--brand-blue)]/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentPage = snapshot.pages.find((page) => page.id === currentPageId);

  // Runtime event handler for preview mode
  const handleRuntimeEvent = (
    elementId: string,
    eventType: string,
    data?: any
  ) => {
    switch (eventType) {
      case "click":
        console.log("🎯 PREVIEW: Element clicked:", elementId);
        // Add workflow execution logic here if needed
        break;
      case "change":
        console.log("🔄 PREVIEW: Input changed:", elementId, data?.value);
        break;
      default:
        console.log("🎯 PREVIEW: Event:", eventType, elementId, data);
    }
  };

  if (!currentPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-red-200 dark:border-red-900">
          <div className="text-4xl mb-4">📄</div>
          <h1 className="text-xl font-bold text-[var(--brand-pink)] mb-4">
            Page Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Page ID: {currentPageId}
          </p>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Available pages: {snapshot.pages.map((p) => p.id).join(", ")}
          </p>
          <button
            onClick={() => navigateToPage(snapshot.pages[0]?.id)}
            className="px-4 py-2 bg-[var(--brand-blue)] text-white dark:text-white rounded hover:bg-[var(--brand-blue)]/90"
          >
            Go to First Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: currentPage.canvasBackground?.color || "#ffffff",
      }}
    >
      {/* Preview Header */}
      <div className="bg-gray-900 dark:bg-gray-950 text-white dark:text-gray-100 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-medium">🎥 App Preview - {appId}</h1>
          <span className="text-xs bg-[var(--brand-green)] text-white dark:text-white px-2 py-1 rounded">
            {currentPage.name}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {snapshot.pages.map((page) => (
            <button
              key={page.id}
              onClick={() => navigateToPage(page.id)}
              className={`px-2 py-1 text-xs rounded ${
                currentPageId === page.id
                  ? "bg-[var(--brand-blue)] text-white dark:text-white"
                  : "bg-gray-700 dark:bg-gray-800 text-gray-300 dark:text-gray-400 hover:bg-gray-600 dark:hover:bg-gray-700"
              }`}
            >
              {page.name}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas Preview - Centered container without scaling */}
      <div className="runtime-reset w-full h-[calc(100vh-56px)] flex items-center justify-center bg-white dark:bg-gray-900 overflow-auto">
        {(() => {
          // Build canvas style with page background/border/shadow
          const pageStyle =
            (currentPage as any).style || currentPage.canvasBackground;
          const canvasStyle: React.CSSProperties = {
            width: currentPage.canvasWidth ?? 960,
            height: currentPage.canvasHeight ?? 640,
            position: "relative",
            overflow: "hidden",
            ...mapPageStyle(pageStyle),
          };

          // Log canvas style for verification
          console.log("[PREVIEW] canvasStyle:", canvasStyle);
          console.log("[PREVIEW] pageStyleHash:", getPageStyleHash(pageStyle));

          return (
            <div style={canvasStyle}>
              <CanvasRenderer
                mode="preview"
                readOnly
                canvasWidth={currentPage.canvasWidth ?? 960}
                canvasHeight={currentPage.canvasHeight ?? 640}
                elements={currentPage.elements as CanvasElement[]}
                onEvent={handleRuntimeEvent}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function PreviewPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const appId = params.appId as string;
  const pageId = searchParams.get("pageId") || undefined;

  return <PreviewContent appId={appId} pageId={pageId} />;
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-blue-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-semibold">Loading Preview...</p>
          </div>
        </div>
      }
    >
      <PreviewPageContent />
    </Suspense>
  );
}
