"use client";

import { useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface CollaborationManagerProps {
  currentAppId: string | null;
  onCanvasUpdate: (data: any) => void;
  onUserJoined: (user: any) => void;
  onUserLeft: (userId: string) => void;
  onCursorMove: (data: { userId: string; x: number; y: number }) => void;
}

export const useCollaborationManager = ({
  currentAppId,
  onCanvasUpdate,
  onUserJoined,
  onUserLeft,
  onCursorMove,
}: CollaborationManagerProps) => {
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initializeSocket = useCallback(() => {
    if (!currentAppId) return;

    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem("authToken");
      if (!token) {
        console.warn("⚠️ No authentication token found");
        return;
      }

      // Initialize socket connection
      socketRef.current = io(
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000",
        {
          auth: {
            token: token,
          },
          transports: ["websocket", "polling"],
          timeout: 20000,
        }
      );

      const socket = socketRef.current;

      // Connection event handlers
      socket.on("connect", () => {
        console.log("✅ Socket connected for collaboration");

        // Join the app room for real-time collaboration
        socket.emit("join-canvas", { appId: currentAppId });
      });

      socket.on("disconnect", (reason) => {
        console.log("❌ Socket disconnected:", reason);

        // Attempt to reconnect after a delay
        if (reason === "io server disconnect") {
          // Server initiated disconnect, don't reconnect automatically
          return;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("🔄 Attempting to reconnect...");
          socket.connect();
        }, 3000);
      });

      socket.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
      });

      // Canvas collaboration events
      socket.on("canvas:element-updated", (data) => {
        console.log("🔄 Received element update from collaborator:", data);
        onCanvasUpdate(data);
      });

      socket.on("canvas:element-added", (data) => {
        console.log("➕ Received new element from collaborator:", data);
        onCanvasUpdate(data);
      });

      socket.on("canvas:element-deleted", (data) => {
        console.log("🗑️ Received element deletion from collaborator:", data);
        onCanvasUpdate(data);
      });

      // User presence events
      socket.on("user:joined", (user) => {
        console.log("👋 User joined canvas:", user);
        onUserJoined(user);
      });

      socket.on("user:left", (userId) => {
        console.log("👋 User left canvas:", userId);
        onUserLeft(userId);
      });

      socket.on("cursor:move", (data) => {
        onCursorMove(data);
      });
    } catch (error) {
      console.error("❌ Error initializing socket:", error);
    }
  }, [currentAppId, onCanvasUpdate, onUserJoined, onUserLeft, onCursorMove]);

  const disconnectSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      console.log("🔌 Disconnecting socket");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Broadcast element updates to other users
  const broadcastElementUpdate = useCallback(
    (elementData: any) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("canvas:update-element", {
          appId: currentAppId,
          element: elementData,
          timestamp: Date.now(),
        });
      }
    },
    [currentAppId]
  );

  // Broadcast element additions to other users
  const broadcastElementAdd = useCallback(
    (elementData: any) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("canvas:add-element", {
          appId: currentAppId,
          element: elementData,
          timestamp: Date.now(),
        });
      }
    },
    [currentAppId]
  );

  // Broadcast element deletions to other users
  const broadcastElementDelete = useCallback(
    (elementId: string) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("canvas:delete-element", {
          appId: currentAppId,
          elementId,
          timestamp: Date.now(),
        });
      }
    },
    [currentAppId]
  );

  // Broadcast cursor movements
  const broadcastCursorMove = useCallback(
    (x: number, y: number) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit("cursor:move", {
          appId: currentAppId,
          x,
          y,
          timestamp: Date.now(),
        });
      }
    },
    [currentAppId]
  );

  // Initialize socket when component mounts or appId changes
  useEffect(() => {
    if (currentAppId) {
      initializeSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [currentAppId, initializeSocket, disconnectSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  return {
    isConnected: socketRef.current?.connected || false,
    broadcastElementUpdate,
    broadcastElementAdd,
    broadcastElementDelete,
    broadcastCursorMove,
    reconnect: initializeSocket,
    disconnect: disconnectSocket,
  };
};

export default useCollaborationManager;
