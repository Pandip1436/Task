const express = require("express");
const router = express.Router();
const taskController = require("../controllers/task.controller");
const upload = require("../middleware/Upload");
const { protect } = require("../middleware/auth.middleware");


// Create task in column
router.post("/", taskController.createTask);

// Get tasks in a column
router.get("/column/:columnId", taskController.getTasksByColumn);

// Update task
router.put("/:id", taskController.updateTask);

// Move task between columns
router.patch("/:id/move", taskController.moveTask);

// Delete task
router.delete("/:id", taskController.deleteTask);

// File attachment routes
router.post("/:id/attachments", upload.array("files", 10), taskController.uploadAttachments);
router.delete("/:id/attachments/:attachmentId", taskController.deleteAttachment);
router.get("/:id/attachments/:attachmentId/download", taskController.downloadAttachment);

// Comment routes
router.get("/:id/comments", protect, taskController.getComments);
router.post("/:id/comments", protect, taskController.addComment);
router.put("/:id/comments/:commentId", protect, taskController.updateComment);
router.delete("/:id/comments/:commentId", protect, taskController.deleteComment);

// NEW ASSIGNMENT ROUTES
router.get('/assigned-to-me', protect, taskController.getMyAssignedTasks);
router.post('/:id/assign', protect, taskController.assignUsers);
router.delete('/:id/assign/:userId', protect, taskController.unassignUser);

module.exports = router;