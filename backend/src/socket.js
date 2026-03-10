
const { Server } = require("socket.io");

let io;

/**
 * Initialize Socket.IO on the HTTP server.
 * Call this once from server.js after app.listen().
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173 " || "https://task-855.pages.dev",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // ── Join a board room ─────────────────────────────────────────────────────
    // Frontend calls: socket.emit("join_board", boardId)
    socket.on("join_board", (boardId) => {
      socket.join(`board:${boardId}`);
      console.log(`[WS] ${socket.id} joined board:${boardId}`);
    });

    // ── Leave a board room ────────────────────────────────────────────────────
    socket.on("leave_board", (boardId) => {
      socket.leave(`board:${boardId}`);
      console.log(`[WS] ${socket.id} left board:${boardId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Get the initialized io instance (for use in controllers).
 */
function getIO() {
  if (!io) throw new Error("Socket.IO not initialized. Call initSocket() first.");
  return io;
}


function emitToBoardRoom(boardId, event, payload, excludeSocketId = null) {
  if (!io) return;
  const room = `board:${boardId}`;
  if (excludeSocketId) {
    io.to(room).except(excludeSocketId).emit(event, payload);
  } else {
    io.to(room).emit(event, payload);
  }
}

module.exports = { initSocket, getIO, emitToBoardRoom };