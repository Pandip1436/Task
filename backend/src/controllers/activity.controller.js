// controllers/activity.controller.js
const Activity = require("../models/Activity");
const { emitToBoardRoom } = require("../socket");

/**
 * Internal helper — called directly by other controllers (not via HTTP).
 * Creates an activity log entry and broadcasts it to the board room.
 */
exports.createActivity = async ({ board, user, type, message }) => {
  try {
    const activity = await Activity.create({ board, user, type, message });

    // Populate user so the frontend can display name/email immediately
    await activity.populate("user", "name email");

    emitToBoardRoom(board?.toString(), "activity:created", { activity });
  } catch (err) {
    console.error("Activity log error:", err.message);
  }
};

/**
 * POST /api/activity
 * Creates an activity log entry from an HTTP request (e.g. from the frontend
 * logActivity helper in TasksPage).
 */
exports.createActivityHttp = async (req, res) => {
  try {
    const { boardId, type, message, entityType, entityId, metadata } = req.body;

    const activity = await Activity.create({
      board:      boardId,
      user:       req.user?._id,
      type,
      message,
      entityType,
      entityId,
      metadata,
    });

    await activity.populate("user", "name email");

    emitToBoardRoom(boardId, "activity:created", { activity }, req.headers["x-socket-id"]);

    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ message: "Failed to create activity" });
  }
};

/**
 * GET /api/activity/board/:boardId
 */
exports.getBoardActivity = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { type, limit = 100, entityType, userId } = req.query;

    const filter = { board: boardId };
    if (type)       filter.type       = type;
    if (entityType) filter.entityType = entityType;
    if (userId)     filter.user       = userId;

    const activities = await Activity.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch activity" });
  }
};

/**
 * DELETE /api/activity/:logId
 */
exports.deleteActivityLog = async (req, res) => {
  try {
    const log = await Activity.findByIdAndDelete(req.params.logId);
    if (!log) return res.status(404).json({ message: "Activity log not found" });

    const boardId = log.board?.toString();
    if (boardId) {
      emitToBoardRoom(boardId, "activity:deleted", { logId: req.params.logId });
    }

    res.json({ message: "Activity log deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete activity log" });
  }
};

/**
 * DELETE /api/activity/board/:boardId/clear
 */

// PATCH: activity.controller.js — add socket emit to clearBoardActivityLogs
// so all connected clients clear their local state simultaneously.

exports.clearBoardActivityLogs = async (req, res) => {
  try {
    const { boardId } = req.params;
    await Activity.deleteMany({ board: boardId });

    // Notify every client in the room (including the sender so they confirm)
    emitToBoardRoom(boardId, "activity:cleared", { boardId });

    res.json({ message: "Activity logs cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear activity logs" });
  }
};