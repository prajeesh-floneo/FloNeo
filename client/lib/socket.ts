import { io, Socket } from 'socket.io-client'
import { getAuthToken } from './auth'

let socket: Socket | null = null

export const initializeSocket = (): Socket => {
  if (socket && socket.connected) {
    return socket
  }

  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token available')
  }

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  socket = io(BACKEND_URL, {
    auth: {
      token: token
    },
    transports: ['websocket', 'polling']
  })

  socket.on('connect', () => {
    console.log('✅ Socket.io connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.io disconnected:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('❌ Socket.io connection error:', error)
  })

  return socket
}

export const getSocket = (): Socket | null => {
  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

// Canvas collaboration events
export const joinCanvasRoom = (appId: number): void => {
  const socket = getSocket()
  if (socket) {
    socket.emit('canvas:join', { appId })
    console.log('🔄 Joined canvas room:', appId)
  }
}

export const leaveCanvasRoom = (appId: number): void => {
  const socket = getSocket()
  if (socket) {
    socket.emit('canvas:leave', { appId })
    console.log('🔄 Left canvas room:', appId)
  }
}

export const emitCanvasUpdate = (appId: number, canvasData: any): void => {
  const socket = getSocket()
  if (socket) {
    socket.emit('canvas:update', { appId, canvasData })
    console.log('🔄 Emitted canvas update:', appId)
  }
}

export const emitElementUpdate = (appId: number, elementData: any): void => {
  const socket = getSocket()
  if (socket) {
    socket.emit('element:update', { appId, elementData })
    console.log('🔄 Emitted element update:', appId, elementData.id)
  }
}

export const emitElementCreate = (appId: number, elementData: any): void => {
  const socket = getSocket()
  if (socket) {
    socket.emit('element:create', { appId, elementData })
    console.log('🔄 Emitted element create:', appId, elementData.id)
  }
}

export const emitElementDelete = (appId: number, elementId: string): void => {
  const socket = getSocket()
  if (socket) {
    socket.emit('element:delete', { appId, elementId })
    console.log('🔄 Emitted element delete:', appId, elementId)
  }
}

// Listen to canvas events
export const onCanvasUpdate = (callback: (data: any) => void): void => {
  const socket = getSocket()
  if (socket) {
    socket.on('canvas:updated', callback)
  }
}

export const onElementUpdate = (callback: (data: any) => void): void => {
  const socket = getSocket()
  if (socket) {
    socket.on('element:updated', callback)
  }
}

export const onElementCreate = (callback: (data: any) => void): void => {
  const socket = getSocket()
  if (socket) {
    socket.on('element:created', callback)
  }
}

export const onElementDelete = (callback: (data: any) => void): void => {
  const socket = getSocket()
  if (socket) {
    socket.on('element:deleted', callback)
  }
}

export const onUserJoined = (callback: (data: any) => void): void => {
  const socket = getSocket()
  if (socket) {
    socket.on('user:joined', callback)
  }
}

export const onUserLeft = (callback: (data: any) => void): void => {
  const socket = getSocket()
  if (socket) {
    socket.on('user:left', callback)
  }
}

// Remove event listeners
export const offCanvasUpdate = (): void => {
  const socket = getSocket()
  if (socket) {
    socket.off('canvas:updated')
  }
}

export const offElementUpdate = (): void => {
  const socket = getSocket()
  if (socket) {
    socket.off('element:updated')
  }
}

export const offElementCreate = (): void => {
  const socket = getSocket()
  if (socket) {
    socket.off('element:created')
  }
}

export const offElementDelete = (): void => {
  const socket = getSocket()
  if (socket) {
    socket.off('element:deleted')
  }
}

export const offUserJoined = (): void => {
  const socket = getSocket()
  if (socket) {
    socket.off('user:joined')
  }
}

export const offUserLeft = (): void => {
  const socket = getSocket()
  if (socket) {
    socket.off('user:left')
  }
}
