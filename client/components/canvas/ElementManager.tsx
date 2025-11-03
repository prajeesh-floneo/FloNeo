"use client";

import { useCallback } from "react";

export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  pageId: string;
  groupId?: string;
  properties: Record<string, any>;
}

export interface ElementManagerProps {
  pages: any[];
  setPages: (pages: any[] | ((prev: any[]) => any[])) => void;
  currentPageId: string;
  selectedElement: CanvasElement | null;
  setSelectedElement: (element: CanvasElement | null) => void;
  selectedElements: CanvasElement[];
  setSelectedElements: (
    elements: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[])
  ) => void;
}

export const useElementManager = ({
  pages,
  setPages,
  currentPageId,
  selectedElement,
  setSelectedElement,
  selectedElements,
  setSelectedElements,
}: ElementManagerProps) => {
  const addElement = useCallback(
    (elementType: string, x: number, y: number) => {
      const newElement: CanvasElement = {
        id: `${elementType.toLowerCase()}-${Date.now()}`,
        type: elementType,
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: getDefaultWidth(elementType),
        height: getDefaultHeight(elementType),
        rotation: 0,
        opacity: 100,
        zIndex: Date.now(),
        pageId: currentPageId,
        groupId: undefined,
        properties: getDefaultProperties(elementType),
      };

      setPages((prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? { ...page, elements: [...page.elements, newElement] }
            : page
        )
      );

      setSelectedElement(newElement);
      setSelectedElements([]);
    },
    [currentPageId, setPages, setSelectedElement, setSelectedElements]
  );

  const updateElement = useCallback(
    (elementId: string, updates: Partial<CanvasElement>) => {
      setPages((prev) =>
        prev.map((page) => ({
          ...page,
          elements: page.elements.map((el: CanvasElement) =>
            el.id === elementId ? { ...el, ...updates } : el
          ),
        }))
      );

      // Update selected element if it's the one being updated
      if (selectedElement?.id === elementId) {
        setSelectedElement({ ...selectedElement, ...updates });
      }

      // Update selected elements if any match
      setSelectedElements((prev) =>
        prev.map((el) => (el.id === elementId ? { ...el, ...updates } : el))
      );
    },
    [setPages, selectedElement, setSelectedElement, setSelectedElements]
  );

  const deleteElement = useCallback(
    (elementId: string) => {
      setPages((prev) =>
        prev.map((page) => ({
          ...page,
          elements: page.elements.filter(
            (el: CanvasElement) => el.id !== elementId
          ),
        }))
      );

      // Clear selection if deleted element was selected
      if (selectedElement?.id === elementId) {
        setSelectedElement(null);
      }

      setSelectedElements((prev) => prev.filter((el) => el.id !== elementId));
    },
    [setPages, selectedElement, setSelectedElement, setSelectedElements]
  );

  const duplicateElement = useCallback(
    (element: CanvasElement) => {
      const duplicatedElement: CanvasElement = {
        ...element,
        id: `${element.type.toLowerCase()}-${Date.now()}`,
        x: element.x + 20,
        y: element.y + 20,
        zIndex: Date.now(),
      };

      setPages((prev) =>
        prev.map((page) =>
          page.id === currentPageId
            ? { ...page, elements: [...page.elements, duplicatedElement] }
            : page
        )
      );

      setSelectedElement(duplicatedElement);
      setSelectedElements([]);
    },
    [currentPageId, setPages, setSelectedElement, setSelectedElements]
  );

  const bringToFront = useCallback(
    (elementId: string) => {
      const maxZIndex = Math.max(
        ...(pages
          .find((p) => p.id === currentPageId)
          ?.elements.map((el: CanvasElement) => el.zIndex) || [0])
      );

      updateElement(elementId, { zIndex: maxZIndex + 1 });
    },
    [pages, currentPageId, updateElement]
  );

  const sendToBack = useCallback(
    (elementId: string) => {
      const minZIndex = Math.min(
        ...(pages
          .find((p) => p.id === currentPageId)
          ?.elements.map((el: CanvasElement) => el.zIndex) || [0])
      );

      updateElement(elementId, { zIndex: minZIndex - 1 });
    },
    [pages, currentPageId, updateElement]
  );

  return {
    addElement,
    updateElement,
    deleteElement,
    duplicateElement,
    bringToFront,
    sendToBack,
  };
};

// Helper functions
const getDefaultWidth = (elementType: string): number => {
  const widthMap: Record<string, number> = {
    BUTTON: 120,
    TEXT_FIELD: 200,
    TEXT_AREA: 200,
    DROPDOWN: 200,
    CHECKBOX: 150,
    RADIO_BUTTON: 150,
    TOGGLE: 150,
    PHONE_FIELD: 200,
    EMAIL_FIELD: 200,
    PASSWORD_FIELD: 200,
    NUMBER_FIELD: 200,
    DATE_FIELD: 200,
    FILE_UPLOAD: 200,
    IMAGE: 200,
    SHAPE: 100,
  };
  return widthMap[elementType] || 100;
};

const getDefaultHeight = (elementType: string): number => {
  const heightMap: Record<string, number> = {
    BUTTON: 40,
    TEXT_FIELD: 40,
    TEXT_AREA: 100,
    DROPDOWN: 40,
    CHECKBOX: 30,
    RADIO_BUTTON: 30,
    TOGGLE: 30,
    PHONE_FIELD: 40,
    EMAIL_FIELD: 40,
    PASSWORD_FIELD: 40,
    NUMBER_FIELD: 40,
    DATE_FIELD: 40,
    FILE_UPLOAD: 40,
    IMAGE: 150,
    SHAPE: 100,
  };
  return heightMap[elementType] || 40;
};

const getDefaultProperties = (elementType: string): Record<string, any> => {
  const propertiesMap: Record<string, Record<string, any>> = {
    BUTTON: {
      text: "Button",
      backgroundColor: "#3b82f6",
      color: "#ffffff",
      borderRadius: 6,
      isSubmitButton: false,
      formGroupId: null,
    },
    TEXT_FIELD: {
      text: "Click to edit text",
      fontSize: 16,
      fontWeight: "normal",
      color: "#000000",
      backgroundColor: "transparent",
      textAlign: "left",
    },
    TEXT_AREA: {
      placeholder: "Enter text",
      value: "",
      rows: 4,
      backgroundColor: "#ffffff",
      color: "#000000",
    },
    DROPDOWN: {
      placeholder: "Select option",
      options: ["Option 1", "Option 2", "Option 3"],
      value: "",
    },
    CHECKBOX: {
      label: "Checkbox",
      checked: false,
    },
    RADIO_BUTTON: {
      label: "Radio Button",
      checked: false,
    },
    TOGGLE: {
      label: "Toggle",
      checked: false,
    },
    PHONE_FIELD: {
      placeholder: "Phone number",
      value: "",
    },
    EMAIL_FIELD: {
      placeholder: "Email address",
      value: "",
    },
    PASSWORD_FIELD: {
      placeholder: "Password",
      value: "",
    },
    NUMBER_FIELD: {
      placeholder: "Enter number",
      value: "",
    },
    DATE_FIELD: {
      placeholder: "Select date",
      value: "",
    },
    FILE_UPLOAD: {
      placeholder: "Choose file",
      acceptedTypes: "*",
    },
    IMAGE: {
      src: "",
      alt: "Image",
    },
    SHAPE: {
      backgroundColor: "#e5e7eb",
      borderColor: "#d1d5db",
      borderWidth: 1,
    },
  };
  return propertiesMap[elementType] || {};
};

export default useElementManager;
