"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { authenticatedFetch } from "@/lib/auth";

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  appId: string | null;
  currentName?: string;
  onSaved?: (newName: string) => void;
}

export default function RenameModal({ isOpen, onClose, appId, currentName = "", onSaved }: RenameModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName || "");
      setError(null);
    }
  }, [isOpen, currentName]);

  const handleSave = async () => {
    if (!appId) return;
    if (!name.trim()) {
      setError("App name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const resp = await authenticatedFetch(`/api/apps/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await resp.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to rename app");
      }

      toast({ title: "App renamed", description: `Renamed to \"${name}\"` });
      onSaved?.(name.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to rename app");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Rename App</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rename-name">App Name</Label>
            <Input
              id="rename-name"
              placeholder="Enter new app name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
