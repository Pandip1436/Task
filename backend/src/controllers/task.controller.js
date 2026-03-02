// task.controller.js — with real-time WebSocket emissions
const Task = require("../models/Task");
const User = require("../models/User");
const fs   = require("fs");
const path = require("path");
const { emitToBoardRoom } = require("../socket");

// ─── helpers ──────────────────────────────────────────────────────────────────
const getBoardId = (task) => task?.board?.toString?.() ?? task?.board ?? null;

/* ============================================ */
/*             TASK CRUD                        */
/* ============================================ */

/** CREATE TASK in a column */
exports.createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, columnId, boardId } = req.body;

    const task = await Task.create({
      title,
      description,
      priority:    priority || "medium",
      dueDate:     dueDate  || null,
      column:      columnId,
      board:       boardId,
      attachments: [],
      comments:    [],
    });

    // Emit to everyone else in the board room
    emitToBoardRoom(boardId, "task:created", { task, columnId, boardId }, req.headers["x-socket-id"]);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** GET TASKS by column */
exports.getTasksByColumn = async (req, res) => {
  try {
    const tasks = await Task.find({ column: req.params.columnId })
      .populate("assignedTo",       "name email")
      .populate("comments.author",  "name email")
      .sort({ order: 1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** UPDATE TASK */
exports.updateTask = async (req, res) => {
  try {
    const {
      title, description, priority, dueDate, order, columnId,
      assignedTo, subtasks, labels, estimatedMinutes, trackedSeconds,
    } = req.body;

    const updateData = {};
    if (title             !== undefined) updateData.title             = title;
    if (description       !== undefined) updateData.description       = description;
    if (priority          !== undefined) updateData.priority          = priority;
    if (dueDate           !== undefined) updateData.dueDate           = dueDate;
    if (order             !== undefined) updateData.order             = order;
    if (columnId          !== undefined) updateData.column            = columnId;
    if (assignedTo        !== undefined) updateData.assignedTo        = assignedTo;
    if (subtasks          !== undefined) updateData.subtasks          = subtasks;
    if (labels            !== undefined) updateData.labels            = labels;
    if (estimatedMinutes  !== undefined) updateData.estimatedMinutes  = estimatedMinutes;
    if (trackedSeconds    !== undefined) updateData.trackedSeconds    = trackedSeconds;

    const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .populate("comments.author", "name email")
      .populate("assignedTo",      "name email");

    if (!task) return res.status(404).json({ message: "Task not found" });

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "task:updated", { task, columnId: task.column?.toString() }, req.headers["x-socket-id"]);
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** DELETE TASK */
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const boardId  = getBoardId(task);
    const columnId = task.column?.toString();
    const taskId   = task._id.toString();

    // Delete attachments from filesystem
    if (task.attachments?.length) {
      task.attachments.forEach((attachment) => {
        const filePath = path.join(__dirname, "../uploads", attachment.name);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (err) { console.error(err); }
        }
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    if (boardId) {
      emitToBoardRoom(boardId, "task:deleted", { taskId, columnId, boardId }, req.headers["x-socket-id"]);
    }

    res.json({ message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** MOVE TASK between columns */
exports.moveTask = async (req, res) => {
  try {
    const { columnId, order, boardId } = req.body;

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { column: columnId, order },
      { new: true }
    ).populate("comments.author", "name email");

    if (!task) return res.status(404).json({ message: "Task not found" });

    const resolvedBoardId = boardId || getBoardId(task);
    if (resolvedBoardId) {
      emitToBoardRoom(resolvedBoardId, "task:moved", {
        task,
        taskId:   task._id.toString(),
        columnId,
        order,
        boardId:  resolvedBoardId,
      }, req.headers["x-socket-id"]);
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*         FILE ATTACHMENT OPERATIONS          */
/* ============================================ */

exports.uploadAttachments = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      req.files?.forEach((f) => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
      return res.status(404).json({ message: "Task not found" });
    }

    const newAttachments = req.files.map((file) => ({
      name:         file.filename,
      originalName: file.originalname,
      size:         file.size,
      type:         file.mimetype,
      url:          `/uploads/${file.filename}`,
      uploadedAt:   new Date(),
    }));

    task.attachments.push(...newAttachments);
    await task.save();

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "task:updated", { task, columnId: task.column?.toString() }, req.headers["x-socket-id"]);
    }

    res.status(200).json(task);
  } catch (error) {
    req.files?.forEach((f) => {
      if (fs.existsSync(f.path)) { try { fs.unlinkSync(f.path); } catch {} }
    });
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const attachment = task.attachments.id(attachmentId);
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });

    const filePath = path.join(__dirname, "../uploads", attachment.name);
    if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (err) { console.error(err); } }

    task.attachments.pull(attachmentId);
    await task.save();

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "task:updated", { task, columnId: task.column?.toString() }, req.headers["x-socket-id"]);
    }

    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const attachment = task.attachments.id(attachmentId);
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });

    const filePath = path.join(__dirname, "../uploads", attachment.name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found on server" });

    res.setHeader("Content-Disposition", `attachment; filename="${attachment.originalName}"`);
    res.setHeader("Content-Type", attachment.type);
    res.download(filePath, attachment.originalName);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*           COMMENT OPERATIONS                */
/* ============================================ */

exports.getComments = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("comments.author", "name email")
      .select("comments");
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task.comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { text, author } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text is required" });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    let authorId;
    if (req.user?._id)        authorId = req.user._id;
    else if (author)          authorId = author;
    else return res.status(400).json({ message: "Author is required." });

    task.comments.push({ text: text.trim(), author: authorId, createdAt: new Date(), updatedAt: new Date() });
    await task.save();

    try { await task.populate("comments.author", "name email"); } catch {}

    const addedComment = task.comments[task.comments.length - 1];

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "comment:added", {
        taskId:   task._id.toString(),
        columnId: task.column?.toString(),
        comment:  addedComment,
      }, req.headers["x-socket-id"]);
    }

    res.status(201).json(addedComment);
  } catch (error) {
    res.status(500).json({ message: error.message, error: error.toString() });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text is required" });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const comment = task.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.text      = text.trim();
    comment.updatedAt = new Date();
    await task.save();
    await task.populate("comments.author", "name email");

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "comment:updated", {
        taskId:   id,
        columnId: task.column?.toString(),
        comment,
      }, req.headers["x-socket-id"]);
    }

    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const comment = task.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    task.comments.pull(commentId);
    await task.save();

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "comment:deleted", {
        taskId:    id,
        columnId:  task.column?.toString(),
        commentId,
      }, req.headers["x-socket-id"]);
    }

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ============================================ */
/*           ASSIGNMENT OPERATIONS             */
/* ============================================ */

exports.assignUsers = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || !userIds.length) {
      return res.status(400).json({ success: false, message: "Please provide user IDs to assign" });
    }

    const users = await User.find({ _id: { $in: userIds }, isActive: true });
    if (users.length !== userIds.length) {
      return res.status(400).json({ success: false, message: "One or more users not found or inactive" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const currentAssignees = task.assignedTo.map((id) => id.toString());
    const newAssignees = userIds.filter((id) => !currentAssignees.includes(id));
    task.assignedTo.push(...newAssignees);
    await task.save();
    await task.populate("assignedTo", "name email");

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "task:updated", { task, columnId: task.column?.toString() }, req.headers["x-socket-id"]);
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to assign users", error: error.message });
  }
};

exports.unassignUser = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.assignedTo = task.assignedTo.filter((u) => u.toString() !== userId);
    await task.save();
    await task.populate("assignedTo", "name email");

    const boardId = getBoardId(task);
    if (boardId) {
      emitToBoardRoom(boardId, "task:updated", { task, columnId: task.column?.toString() }, req.headers["x-socket-id"]);
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to unassign user", error: error.message });
  }
};

exports.getMyAssignedTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate("column",     "name")
      .populate("board",      "name")
      .populate("assignedTo", "name email")
      .populate("createdBy",  "name email")
      .sort({ dueDate: 1, createdAt: -1 });

    res.status(200).json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assigned tasks", error: error.message });
  }
};