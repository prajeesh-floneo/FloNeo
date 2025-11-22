// import { io, Socket } from 'socket.io-client'
// import { getAuthToken } from './auth'

// let socket: Socket | null = null

// export const initializeSocket = (): Socket => {
//   if (socket && socket.connected) {
//     return socket
//   }

//   const token = getAuthToken()
//   if (!token) {
//     throw new Error('No authentication token available')
//   }

//   const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

//   socket = io(BACKEND_URL, {
//     auth: {
//       token: token
//     },
//     transports: ['websocket', 'polling']
//   })

//   socket.on('connect', () => {
//     console.log('✅ Socket.io connected:', socket?.id)
//   })

//   socket.on('disconnect', (reason) => {
//     console.log('❌ Socket.io disconnected:', reason)
//   })

//   socket.on('connect_error', (error) => {
//     console.error('❌ Socket.io connection error:', error)
//   })

//   return socket
// }

// export const getSocket = (): Socket | null => {
//   return socket
// }

// export const disconnectSocket = (): void => {
//   if (socket) {
//     socket.disconnect()
//     socket = null
//   }
// }

// // Canvas collaboration events
// export const joinCanvasRoom = (appId: number): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.emit('canvas:join', { appId })
//     console.log('🔄 Joined canvas room:', appId)
//   }
// }

// export const leaveCanvasRoom = (appId: number): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.emit('canvas:leave', { appId })
//     console.log('🔄 Left canvas room:', appId)
//   }
// }

// export const emitCanvasUpdate = (appId: number, canvasData: any): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.emit('canvas:update', { appId, canvasData })
//     console.log('🔄 Emitted canvas update:', appId)
//   }
// }

// export const emitElementUpdate = (appId: number, elementData: any): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.emit('element:update', { appId, elementData })
//     console.log('🔄 Emitted element update:', appId, elementData.id)
//   }
// }

// export const emitElementCreate = (appId: number, elementData: any): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.emit('element:create', { appId, elementData })
//     console.log('🔄 Emitted element create:', appId, elementData.id)
//   }
// }

// export const emitElementDelete = (appId: number, elementId: string): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.emit('element:delete', { appId, elementId })
//     console.log('🔄 Emitted element delete:', appId, elementId)
//   }
// }

// // Listen to canvas events
// export const onCanvasUpdate = (callback: (data: any) => void): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.on('canvas:updated', callback)
//   }
// }

// export const onElementUpdate = (callback: (data: any) => void): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.on('element:updated', callback)
//   }
// }

// export const onElementCreate = (callback: (data: any) => void): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.on('element:created', callback)
//   }
// }

// export const onElementDelete = (callback: (data: any) => void): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.on('element:deleted', callback)
//   }
// }

// export const onUserJoined = (callback: (data: any) => void): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.on('user:joined', callback)
//   }
// }

// export const onUserLeft = (callback: (data: any) => void): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.on('user:left', callback)
//   }
// }

// // Remove event listeners
// export const offCanvasUpdate = (): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.off('canvas:updated')
//   }
// }

// export const offElementUpdate = (): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.off('element:updated')
//   }
// }

// export const offElementCreate = (): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.off('element:created')
//   }
// }

// export const offElementDelete = (): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.off('element:deleted')
//   }
// }

// export const offUserJoined = (): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.off('user:joined')
//   }
// }

// export const offUserLeft = (): void => {
//   const socket = getSocket()
//   if (socket) {
//     socket.off('user:left')
//   }
// }


// client/lib/socket.ts
import { io, Socket } from "socket.io-client";
import { getAuthToken } from "./auth";

let socket: Socket | null = null;

// Helper function to register socket event listeners
const registerSocketListeners = (socket: Socket) => {
  // Remove existing listeners to prevent duplicates
  socket.off("database:data-updated");
  socket.off("database:table-created");
  socket.off("record:updated");
  socket.off("app-user:created");
  socket.off("app-user:updated");
  socket.off("app-user:deleted");
  
  console.log("🔧 [SOCKET] Registering app-user event listeners");

  // 🔥 Real-time database events - Match backend event names
  socket.on("database:data-updated", (payload) => {
    console.log("🟢 [SOCKET] Database Data Updated:", payload);
    const { action, tableName } = payload;
    
    // Map backend action to frontend event names
    if (action === "create" || action === "insert") {
      window.dispatchEvent(
        new CustomEvent("db_record_created", { detail: { ...payload, tableName, action: "created" } })
      );
    } else if (action === "update") {
      window.dispatchEvent(
        new CustomEvent("db_record_updated", { detail: { ...payload, tableName, action: "updated" } })
      );
    } else if (action === "delete") {
      window.dispatchEvent(
        new CustomEvent("db_record_deleted", { detail: { ...payload, tableName, action: "deleted" } })
      );
    }
  });

  socket.on("database:table-created", (payload) => {
    console.log("🟢 [SOCKET] Table Created:", payload);
    window.dispatchEvent(
      new CustomEvent("db_table_created", { detail: payload })
    );
  });

  // Also listen to global record:updated event (for backward compatibility)
  socket.on("record:updated", (payload) => {
    console.log("🟢 [SOCKET] Record Updated (global):", payload);
    window.dispatchEvent(
      new CustomEvent("db_record_updated", { detail: { ...payload, action: "updated" } })
    );
  });

  // App User events - dispatch as window events (CRITICAL: Must be registered)
  socket.on("app-user:created", (payload) => {
    console.log("🟢🟢🟢 [SOCKET] App User Created event received:", JSON.stringify(payload, null, 2));
    try {
      const event = new CustomEvent("app_user_created", { detail: payload });
      window.dispatchEvent(event);
      console.log("✅✅✅ [SOCKET] Window event 'app_user_created' dispatched successfully");
    } catch (e) {
      console.error("❌❌❌ [SOCKET] Error dispatching app_user_created:", e);
    }
  });

  socket.on("app-user:updated", (payload) => {
    console.log("🟢🟢🟢 [SOCKET] App User Updated event received:", JSON.stringify(payload, null, 2));
    try {
      const event = new CustomEvent("app_user_updated", { detail: payload });
      window.dispatchEvent(event);
      console.log("✅✅✅ [SOCKET] Window event 'app_user_updated' dispatched successfully");
    } catch (e) {
      console.error("❌❌❌ [SOCKET] Error dispatching app_user_updated:", e);
    }
  });

  socket.on("app-user:deleted", (payload) => {
    console.log("🟢🟢🟢 [SOCKET] App User Deleted event received:", JSON.stringify(payload, null, 2));
    try {
      const event = new CustomEvent("app_user_deleted", { detail: payload });
      window.dispatchEvent(event);
      console.log("✅✅✅ [SOCKET] Window event 'app_user_deleted' dispatched successfully");
    } catch (e) {
      console.error("❌❌❌ [SOCKET] Error dispatching app_user_deleted:", e);
    }
  });
  
  console.log("✅ [SOCKET] App-user event listeners registered successfully");
};

export const initializeSocket = (): Socket => {
  // If socket exists and is connected, ensure listeners are registered
  if (socket && socket.connected) {
    registerSocketListeners(socket);
    return socket;
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error("No authentication token available");
  }

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  socket = io(BACKEND_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log("✅ Socket.io connected:", socket?.id);
    // Register listeners after connection
    registerSocketListeners(socket!);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket.io disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Socket.io connection error:", error);
  });

  // Register listeners immediately (they'll work once connected)
  registerSocketListeners(socket);

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Join database room for real-time updates
export const joinDatabaseRoom = (appId: number | string): void => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit("database:join-app", appId);
    console.log("🔄 Joined database room for app:", appId);
  } else {
    console.warn("⚠️ Socket not connected, cannot join database room");
  }
};

// Leave database room
export const leaveDatabaseRoom = (appId: number | string): void => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit("database:leave-app", appId);
    console.log("🔄 Left database room for app:", appId);
  }
};

// Existing canvas events (no change)
export const joinCanvasRoom = (appId: number): void => {
  const socket = getSocket();
  if (socket) {
    socket.emit("canvas:join", { appId });
    console.log("🔄 Joined canvas room:", appId);
  }
};

export const leaveCanvasRoom = (appId: number): void => {
  const socket = getSocket();
  if (socket) {
    socket.emit("canvas:leave", { appId });
    console.log("🔄 Left canvas room:", appId);
  }
};
// Utility functions to subscribe to DB events (optional)
export const onDBRecordUpdated = (callback: (payload: any) => void): void => {
  window.addEventListener("db_record_updated", (event: any) => {
    callback(event.detail);
  });
};

export const onDBRecordCreated = (callback: (payload: any) => void): void => {
  window.addEventListener("db_record_created", (event: any) => {
    callback(event.detail);
  });
};

export const onDBRecordDeleted = (callback: (payload: any) => void): void => {
  window.addEventListener("db_record_deleted", (event: any) => {
    callback(event.detail);
  });
};
