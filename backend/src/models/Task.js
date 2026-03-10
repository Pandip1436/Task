const mongoose = require("mongoose");

// Comment subdocument schema
const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Attachment subdocument schema
const attachmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});
const subtaskSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false }
});


// Main Task schema
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    subtasks: [subtaskSchema],
    labels: [{
       type: String
       }],
    estimatedMinutes: {
      type: Number,
      default: 0
    },
    trackedSeconds: {
      type: Number,
      default: 0
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    },
    dueDate: {
      type: Date,
      default: null
    },
    order: {
      type: Number,
      default: 0
    },
    column: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Column",
      required: true
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true
    },
     assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
    attachments: [attachmentSchema],
    comments: [commentSchema] // Add comments array
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt to the task
  }
);

// Index for better query performance
taskSchema.index({ column: 1, order: 1 });
taskSchema.index({ board: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Task", taskSchema);