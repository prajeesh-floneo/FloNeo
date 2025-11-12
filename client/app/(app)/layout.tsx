"use client";

import { WorkflowHeader } from "@/components/Header";
import { CanvasWorkflowProvider } from "@/lib/canvas-workflow-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CanvasWorkflowProvider>
      <div className="flex h-screen flex-col">
        <WorkflowHeader />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </CanvasWorkflowProvider>
  );
}
