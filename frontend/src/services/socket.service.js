// src/services/socket.service.js
// Singleton Socket.IO client. Import { socketService } anywhere you need it.
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

class SocketService {
  constructor() {
    this.socket = null;
  }

  /** Connect (idempotent — safe to call multiple times) */
  connect() {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      autoConnect:    true,
      reconnection:   true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1500,
      transports: ["websocket", "polling"],
      auth: {
        // Attach JWT so the server can optionally verify the user
        token: localStorage.getItem("token") || "",
      },
    });

    this.socket.on("connect", () => {
      console.log("[WS] Connected:", this.socket.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[WS] Connection error:", err.message);
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** The raw socket id — used as X-Socket-Id header so the server can exclude us */
  get id() {
    return this.socket?.id ?? null;
  }

  joinBoard(boardId) {
    this.socket?.emit("join_board", boardId);
  }

  leaveBoard(boardId) {
    this.socket?.emit("leave_board", boardId);
  }

  on(event, handler) {
    this.socket?.on(event, handler);
  }

  off(event, handler) {
    this.socket?.off(event, handler);
  }
}

export const socketService = new SocketService();