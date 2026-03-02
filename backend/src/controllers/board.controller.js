// controllers/board.controller.js
const Board   = require("../models/Board");
const Project = require("../models/Project");
const { emitToBoardRoom } = require("../socket");

/* CREATE BOARD */
exports.createBoard = async (req, res) => {
  try {
    const { name, projectId, description } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const board = await Board.create({ name, description, project: projectId });

    project.boards.push(board._id);
    await project.save();

    // Notify everyone watching this project's board list
    emitToBoardRoom(`project:${projectId}`, "board:created", { board }, req.headers["x-socket-id"]);

    res.status(201).json(board);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* GET ALL BOARDS */
exports.getBoards = async (req, res) => {
  try {
    const boards = await Board.find().populate("project");
    res.json(boards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* GET BOARDS BY PROJECT */
exports.getBoardsByProject = async (req, res) => {
  try {
    const boards = await Board.find({ project: req.params.projectId });
    res.json(boards);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* GET SINGLE BOARD */
exports.getBoardById = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id).populate("project");
    if (!board) return res.status(404).json({ message: "Board not found" });
    res.json(board);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* UPDATE BOARD */
exports.updateBoard = async (req, res) => {
  try {
    const board = await Board.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!board) return res.status(404).json({ message: "Board not found" });

    const boardId   = board._id.toString();
    const projectId = board.project?.toString();

    // Notify clients viewing this board
    emitToBoardRoom(boardId, "board:updated", { board }, req.headers["x-socket-id"]);

    // Also notify the project-level room (e.g. board list page)
    if (projectId) {
      emitToBoardRoom(`project:${projectId}`, "board:updated", { board }, req.headers["x-socket-id"]);
    }

    res.json(board);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* DELETE BOARD */
exports.deleteBoard = async (req, res) => {
  try {
    const board = await Board.findByIdAndDelete(req.params.id);
    if (!board) return res.status(404).json({ message: "Board not found" });

    const boardId   = board._id.toString();
    const projectId = board.project?.toString();

    // Remove board reference from project
    await Project.findByIdAndUpdate(board.project, { $pull: { boards: board._id } });

    // Notify clients still viewing this board (redirect them away)
    emitToBoardRoom(boardId, "board:deleted", { boardId, projectId });

    // Notify the project-level room
    if (projectId) {
      emitToBoardRoom(`project:${projectId}`, "board:deleted", { boardId, projectId });
    }

    res.json({ message: "Board deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};