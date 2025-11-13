"use client";

import React from "react";

interface TestDisplayElementProps {
  data: any;
}

export default function TestDisplayElement({ data }: TestDisplayElementProps) {
  // Defensive handling for various shapes
  const display = data === undefined || data === null ? "(no data)" : data;

  return (
    <div className="w-full max-h-[60vh] overflow-auto">
      <pre className="whitespace-pre-wrap text-xs sm:text-sm bg-gray-50 p-4 rounded border overflow-auto">
        <code className="block">{JSON.stringify(display, null, 2)}</code>
      </pre>
    </div>
  );
}
