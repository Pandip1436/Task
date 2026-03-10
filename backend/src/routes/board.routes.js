const express = require("express");
const router = express.Router();
const boardController = require("../controllers/board.controller");

router.post("/", boardController.createBoard);                     // CREATE
router.get("/", boardController.getBoards);                        // READ ALL
router.get("/project/:projectId", boardController.getBoardsByProject); // READ BY PROJECT
router.get("/:id", boardController.getBoardById);                  // READ ONE
router.put("/:id", boardController.updateBoard);                   // UPDATE
router.delete("/:id", boardController.deleteBoard);                // DELETE


module.exports = router;
