// column.controller.ws-patch.js
// Drop these emit calls into your existing column controller.
// This is the full controller with socket emissions added.
const Column = require("../models/Column");
const Task   = require("../models/Task");
const { emitToBoardRoom } = require("../socket");

exports.createColumn = async (req, res) => {
  try {
    const { name, boardId } = req.body;
    const column = await Column.create({ name, board: boardId });

    emitToBoardRoom(boardId, "column:created", { column, boardId }, req.headers["x-socket-id"]);

    res.status(201).json(column);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getColumnsByBoard = async (req, res) => {
  try {
    const columns = await Column.find({ board: req.params.boardId }).sort({ order: 1 });
    res.json(columns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateColumn = async (req, res) => {
  try {
    const { name, order } = req.body;
    const column = await Column.findByIdAndUpdate(
      req.params.id,
      { ...(name !== undefined && { name }), ...(order !== undefined && { order }) },
      { new: true }
    );
    if (!column) return res.status(404).json({ message: "Column not found" });

    const boardId = column.board?.toString();
    if (boardId) {
      emitToBoardRoom(boardId, "column:updated", { column, boardId }, req.headers["x-socket-id"]);
    }

    res.json(column);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteColumn = async (req, res) => {
  try {
    const column = await Column.findById(req.params.id);
    if (!column) return res.status(404).json({ message: "Column not found" });

    const boardId  = column.board?.toString();
    const columnId = column._id.toString();

    await Task.deleteMany({ column: req.params.id });
    await Column.findByIdAndDelete(req.params.id);

    if (boardId) {
      emitToBoardRoom(boardId, "column:deleted", { columnId, boardId }, req.headers["x-socket-id"]);
    }

    res.json({ message: "Column deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};