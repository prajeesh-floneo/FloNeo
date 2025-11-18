import type React from "react";
import type { Metadata } from "next";
// Avoid fetching Google Fonts at build time inside Docker by not using next/font/google
import { Suspense } from "react";
import { CanvasWorkflowProvider } from "../lib/canvas-workflow-context";
import "./globals.css";
import "../styles/design-system.css";
import { WorkflowHeader } from "@/components/Header";

// Use a CSS variable fallback for the font to prevent remote fetch during build
// The actual Poppins font can be provided via local assets or the hosting environment if desired.

export const metadata: Metadata = {
  title: "Floneo - Low-Code No-Code Platform",
  description: "Sign in to your Floneo account",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="light">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var saved = localStorage.getItem('floneo-theme');
                  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = saved || (prefersDark ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-theme', theme);
                  console.log('[THEME] Initialized with theme:', theme);
                } catch(e) {
                  console.error('[THEME] Error initializing theme:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`font-sans`}
        style={{
          // Provide a CSS variable fallback so build does not need to fetch Google Fonts
          ["--font-poppins" as any]:
            'Poppins, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <CanvasWorkflowProvider>
          {/* <WorkflowHeader/> */}
          <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        </CanvasWorkflowProvider>
      </body>
    </html>
  );
}
