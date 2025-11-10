"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { WorkflowNodeData } from "./workflow-node";

interface WorkflowNodeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData: WorkflowNodeData;
  nodeId: string;
  onUpdate: (key: string, value: any) => void;
}

export const WorkflowNodeConfigModal: React.FC<WorkflowNodeConfigModalProps> = ({
  isOpen,
  onClose,
  nodeData,
  nodeId,
  onUpdate,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Configure {nodeData.label}
          </DialogTitle>
          <DialogDescription>
            {nodeData.description || `Configure settings for this ${nodeData.category.toLowerCase()} block`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Placeholder for configuration content */}
          <div className="text-sm text-muted-foreground">
            Configuration options for {nodeData.label} will be displayed here.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

