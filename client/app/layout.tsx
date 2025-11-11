import type React from "react";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Suspense } from "react";
import { CanvasWorkflowProvider } from "../lib/canvas-workflow-context";
import "./globals.css";
import "../styles/design-system.css";
import { WorkflowHeader } from "@/components/Header";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

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
      <body className={`font-sans ${poppins.variable}`}>
        <CanvasWorkflowProvider>
          {/* <WorkflowHeader/> */}
          <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        </CanvasWorkflowProvider>
      </body>
    </html>
  );
}
