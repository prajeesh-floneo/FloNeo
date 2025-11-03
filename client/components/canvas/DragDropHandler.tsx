"use client";

import { useCallback } from "react";

export interface DragDropHandlerProps {
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  dragOffset: { x: number; y: number };
  setDragOffset: (offset: { x: number; y: number }) => void;
  selectedElement: any;
  setSelectedElement: (element: any) => void;
  selectedElements: any[];
  setSelectedElements: (elements: any[]) => void;
  canvasTransform: { x: number; y: number; scale: number };
  updateElementTransform: (elementId: string, transform: any) => void;
  onElementSelect: (element: any, multiSelect?: boolean) => void;
}

export const useDragDropHandler = ({
  isDragging,
  setIsDragging,
  dragOffset,
  setDragOffset,
  selectedElement,
  setSelectedElement,
  selectedElements,
  setSelectedElements,
  canvasTransform,
  updateElementTransform,
  onElementSelect,
}: DragDropHandlerProps) => {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, element: any) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      setDragOffset({ x: offsetX, y: offsetY });
      setIsDragging(true);

      // Handle multi-selection
      if (e.ctrlKey || e.metaKey) {
        onElementSelect(element, true);
      } else if (!selectedElements.some(el => el.id === element.id)) {
        onElementSelect(element, false);
      }
    },
    [
      setDragOffset,
      setIsDragging,
      selectedElements,
      onElementSelect,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || (!selectedElement && selectedElements.length === 0)) return;

      const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - canvasRect.left - dragOffset.x) / canvasTransform.scale;
      const y = (e.clientY - canvasRect.top - dragOffset.y) / canvasTransform.scale;

      // Update positions for all selected elements
      const elementsToUpdate = selectedElements.length > 0 ? selectedElements : [selectedElement];
      
      elementsToUpdate.forEach((element) => {
        if (element) {
          updateElementTransform(element.id, {
            x: Math.max(0, x),
            y: Math.max(0, y),
          });
        }
      });
    },
    [
      isDragging,
      selectedElement,
      selectedElements,
      dragOffset,
      canvasTransform,
      updateElementTransform,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  }, [setIsDragging, setDragOffset]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Only clear selection if clicking on empty canvas area
      if (e.target === e.currentTarget) {
        setSelectedElement(null);
        setSelectedElements([]);
      }
    },
    [setSelectedElement, setSelectedElements]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleCanvasClick,
  };
};

export default useDragDropHandler;
