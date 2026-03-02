const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["create", "edit", "delete", "move", "assign", "comment", "status"],
      index: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    entityType: {
      type: String,
      enum: ["task", "column", "board", "comment", "attachment"],
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient board queries
activityLogSchema.index({ board: 1, createdAt: -1 });

// Compound index for filtering by type
activityLogSchema.index({ board: 1, type: 1, createdAt: -1 });

// TTL index to auto-delete logs older than 90 days (optional)
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model("ActivityLog", activityLogSchema);