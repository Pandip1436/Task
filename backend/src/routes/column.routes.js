const express = require("express");
const router = express.Router();
const columnController = require("../controllers/column.controller");

router.post("/", columnController.createColumn);
router.get("/board/:boardId", columnController.getColumnsByBoard);
router.put("/:id", columnController.updateColumn);
router.delete("/:id", columnController.deleteColumn);

module.exports = router;
