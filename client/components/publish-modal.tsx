"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Globe, CheckCircle } from "lucide-react";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  appId: string;
  currentAppName?: string;
}

interface PublishData {
  name: string;
  description: string;
  version: string;
  isPublic: boolean;
}

export function PublishModal({ isOpen, onClose, appId, currentAppName = "" }: PublishModalProps) {
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishData, setPublishData] = useState<PublishData>({
    name: currentAppName,
    description: "",
    version: "1.0.0",
    isPublic: false,
  });
  const [errors, setErrors] = useState<Partial<PublishData>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPublishData({
        name: currentAppName,
        description: "",
        version: "1.0.0",
        isPublic: false,
      });
      setErrors({});
    }
  }, [isOpen, currentAppName]);

  const validateForm = (): boolean => {
    const newErrors: Partial<PublishData> = {};

    if (!publishData.name.trim()) {
      newErrors.name = "App name is required";
    }

    if (!publishData.description.trim()) {
      newErrors.description = "App description is required";
    }

    if (!publishData.version.trim()) {
      newErrors.version = "Version is required";
    } else if (!/^\d+\.\d+\.\d+$/.test(publishData.version)) {
      newErrors.version = "Version must be in format X.Y.Z (e.g., 1.0.0)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePublish = async () => {
    if (!validateForm()) {
      return;
    }

    setIsPublishing(true);

    try {
      console.log("🚀 [PUBLISH] Publishing app:", appId, publishData);

      const response = await authenticatedFetch(`/api/apps/${appId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: publishData.name.trim(),
          description: publishData.description.trim(),
          version: publishData.version.trim(),
          isPublic: publishData.isPublic,
          publishedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to publish app");
      }

      const result = await response.json();
      console.log("✅ [PUBLISH] App published successfully:", result);

      toast({
        title: "App Published Successfully! 🎉",
        description: `${publishData.name} v${publishData.version} is now ${publishData.isPublic ? "publicly" : "privately"} available.`,
        variant: "default",
        duration: 5000,
      });

      onClose();
    } catch (error) {
      console.error("❌ [PUBLISH] Error publishing app:", error);
      
      toast({
        title: "Publishing Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred while publishing the app.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleInputChange = (field: keyof PublishData, value: string | boolean) => {
    setPublishData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Publish Your App
          </DialogTitle>
          <DialogDescription>
            Make your app available for others to use. Fill in the details below to publish your creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* App Name */}
          <div className="space-y-2">
            <Label htmlFor="app-name">App Name *</Label>
            <Input
              id="app-name"
              placeholder="Enter your app name"
              value={publishData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* App Description */}
          <div className="space-y-2">
            <Label htmlFor="app-description">Description *</Label>
            <Textarea
              id="app-description"
              placeholder="Describe what your app does and its key features..."
              value={publishData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className={`min-h-[100px] ${errors.description ? "border-red-500" : ""}`}
              maxLength={500}
            />
            <div className="flex justify-between items-center">
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
              <p className="text-sm text-gray-500 ml-auto">
                {publishData.description.length}/500
              </p>
            </div>
          </div>

          {/* Version */}
          <div className="space-y-2">
            <Label htmlFor="app-version">Version *</Label>
            <Input
              id="app-version"
              placeholder="1.0.0"
              value={publishData.version}
              onChange={(e) => handleInputChange("version", e.target.value)}
              className={errors.version ? "border-red-500" : ""}
            />
            {errors.version && (
              <p className="text-sm text-red-500">{errors.version}</p>
            )}
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is-public"
              checked={publishData.isPublic}
              onChange={(e) => handleInputChange("isPublic", e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <Label htmlFor="is-public" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Make this app publicly discoverable
            </Label>
          </div>
          
          {publishData.isPublic && (
            <p className="text-sm text-gray-600 ml-6">
              Public apps can be discovered and used by other Floneo users.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPublishing}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isPublishing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Publishing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Publish App
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
