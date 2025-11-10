"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, any>;
  rotation: number;
  opacity: number;
  pageId: string;
  zIndex: number;
  groupId?: string;
  workflowTriggerId?: string; // NEW: Link to workflow trigger
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    category: string;
    linkedElementId?: string; // NEW: Link to canvas element
    [key: string]: any;
  };
}

export interface AppPage {
  id: string;
  name: string;
  elements?: any[];
  groups?: any[];
  canvasWidth?: number;
  canvasHeight?: number;
}

interface CanvasWorkflowContextType {
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;
  linkedElements: Map<string, string>; // elementId -> workflowTriggerId
  setLinkedElements: (links: Map<string, string>) => void;
  linkElementToWorkflow: (elementId: string, workflowTriggerId: string) => void;
  unlinkElement: (elementId: string) => void;
  getWorkflowForElement: (elementId: string) => string | null;
  getElementForWorkflow: (workflowTriggerId: string) => string | null;
  pages: AppPage[]; // NEW: Canvas pages for page.redirect
  setPages: (pages: AppPage[]) => void;
  workflows: Map<string, any>; // NEW: Store workflows by element ID
  setWorkflows: (workflows: Map<string, any>) => void;
  isPreviewMode: boolean; // NEW: Preview mode state
  setIsPreviewMode: (isPreview: boolean) => void;
  currentAppId: string | null; // NEW: Current app ID for workflow integration
  setCurrentAppId: (appId: string | null) => void;
  canvasElements: any[]; // NEW: Canvas elements for IsFilled dropdown
  setCanvasElements: (elements: any[]) => void;
  formGroups: any[]; // NEW: Form groups for OnSubmit dropdown
  setFormGroups: (groups: any[]) => void;
}

const CanvasWorkflowContext = createContext<
  CanvasWorkflowContextType | undefined
>(undefined);

export const useCanvasWorkflow = () => {
  const context = useContext(CanvasWorkflowContext);
  if (!context) {
    throw new Error(
      "useCanvasWorkflow must be used within a CanvasWorkflowProvider"
    );
  }
  return context;
};

export const CanvasWorkflowProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null
  );
  const [linkedElements, setLinkedElements] = useState<Map<string, string>>(
    new Map()
  );
  const [pages, setPages] = useState<AppPage[]>([]);
  const [workflows, setWorkflows] = useState<Map<string, any>>(new Map());
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [currentAppId, setCurrentAppId] = useState<string | null>(null);
  const [canvasElements, setCanvasElements] = useState<any[]>([]);
  const [formGroups, setFormGroups] = useState<any[]>([]);

  // Debug: Log selectedElementId changes
  useEffect(() => {
    console.log("🔍 CONTEXT: selectedElementId changed to:", selectedElementId);
  }, [selectedElementId]);

  // Debug: Log pages changes in context
  useEffect(() => {
    console.log(
      "🔄 CONTEXT: Pages updated in CanvasWorkflowProvider:",
      pages.length,
      "pages:",
      pages.map((p) => ({ id: p.id, name: p.name }))
    );
  }, [pages]);

  // Custom setPages with debugging
  const setPagesWithDebug = useCallback((newPages: AppPage[]) => {
    console.log(
      "🔄 CONTEXT: setPagesWithDebug called with:",
      newPages.length,
      "pages:",
      newPages.map((p) => ({ id: p.id, name: p.name }))
    );
    setPages(newPages);
  }, []);

  const linkElementToWorkflow = useCallback(
    (elementId: string, workflowTriggerId: string) => {
      setLinkedElements((prev) =>
        new Map(prev).set(elementId, workflowTriggerId)
      );
    },
    []
  );

  const unlinkElement = useCallback((elementId: string) => {
    setLinkedElements((prev) => {
      const newMap = new Map(prev);
      newMap.delete(elementId);
      return newMap;
    });
  }, []);

  const getWorkflowForElement = useCallback(
    (elementId: string) => {
      return linkedElements.get(elementId) || null;
    },
    [linkedElements]
  );

  const getElementForWorkflow = useCallback(
    (workflowTriggerId: string) => {
      for (const [elementId, triggerId] of linkedElements.entries()) {
        if (triggerId === workflowTriggerId) {
          return elementId;
        }
      }
      return null;
    },
    [linkedElements]
  );

  const value: CanvasWorkflowContextType = {
    selectedElementId,
    setSelectedElementId,
    linkedElements,
    setLinkedElements,
    linkElementToWorkflow,
    unlinkElement,
    getWorkflowForElement,
    getElementForWorkflow,
    pages,
    setPages: setPagesWithDebug,
    workflows,
    setWorkflows,
    isPreviewMode,
    setIsPreviewMode,
    currentAppId,
    setCurrentAppId,
    canvasElements,
    setCanvasElements,
    formGroups,
    setFormGroups,
  };

  return (
    <CanvasWorkflowContext.Provider value={value}>
      {children}
    </CanvasWorkflowContext.Provider>
  );
};
