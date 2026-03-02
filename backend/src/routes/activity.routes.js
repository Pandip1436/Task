const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");

const ActivityLog = require("../models/ActivityLog");
const Board = require("../models/Board");

/**
 * @route   GET /api/activity/board/:boardId
 * @desc    Get all activity logs for a board
 * @access  Private
 */
router.get("/board/:boardId", protect, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { type, limit, entityType } = req.query;

    // Verify user has access to this board
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Build query
    const query = { board: boardId };
    if (type) query.type = type;
    if (entityType) query.entityType = entityType;

    // Get logs with user population
    let logsQuery = ActivityLog.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    if (limit) {
      logsQuery = logsQuery.limit(parseInt(limit));
    }

    const logs = await logsQuery;

    res.json(logs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   POST /api/activity
 * @desc    Create a new activity log entry
 * @access  Private
 */
router.post("/", protect, async (req, res) => {
  try {
    const { boardId, type, message, entityType, entityId, metadata } = req.body;

    // Validate required fields
    if (!boardId || !type || !message) {
      return res.status(400).json({ 
        message: "boardId, type, and message are required" 
      });
    }

    // Verify board exists
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Create activity log
    const activityLog = new ActivityLog({
      board: boardId,
      user: req.user.id,
      type,
      message,
      entityType,
      entityId,
      metadata,
    });

    await activityLog.save();

    // Populate user data before returning
    await activityLog.populate("user", "name email");

    res.status(201).json(activityLog);
  } catch (error) {
    console.error("Error creating activity log:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   DELETE /api/activity/:id
 * @desc    Delete an activity log entry
 * @access  Private (admin/creator only)
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const activityLog = await ActivityLog.findById(req.params.id);

    if (!activityLog) {
      return res.status(404).json({ message: "Activity log not found" });
    }

    // Only allow creator or admin to delete
    if (activityLog.user.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await activityLog.deleteOne();

    res.json({ message: "Activity log deleted" });
  } catch (error) {
    console.error("Error deleting activity log:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   DELETE /api/activity/board/:boardId/clear
 * @desc    Clear all activity logs for a board
 * @access  Private (admin only)
 */
router.delete("/board/:boardId/clear", protect, async (req, res) => {
  try {
    const { boardId } = req.params;

    // Verify user is admin or board owner
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Delete all logs for this board
    const result = await ActivityLog.deleteMany({ board: boardId });

    res.json({ 
      message: "Activity logs cleared", 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("Error clearing activity logs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * @route   GET /api/activity/recent
 * @desc    Get recent activity across all boards user has access to
 * @access  Private
 */
router.get("/recent", protect, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Get all boards user has access to
    const boards = await Board.find({
      $or: [
        { createdBy: req.user.id },
        { "members.user": req.user.id },
      ],
    }).select("_id");

    const boardIds = boards.map((b) => b._id);

    // Get recent activity from these boards
    const logs = await ActivityLog.find({ board: { $in: boardIds } })
      .populate("user", "name email")
      .populate("board", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(logs);
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;