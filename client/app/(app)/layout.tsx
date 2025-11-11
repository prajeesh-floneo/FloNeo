"use client";

import { WorkflowHeader } from "@/components/Header";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <WorkflowHeader />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
