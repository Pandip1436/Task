const Project = require("../models/Project");
const { emitToAll } = require("../socket");

/* CREATE PROJECT */
exports.createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);

    // 🔴 Emit socket event
    emitToAll("project:created", { project });

    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* GET ALL PROJECTS */
exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find().populate("boards");
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* GET SINGLE PROJECT */
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate("boards");
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* UPDATE PROJECT */
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!project) return res.status(404).json({ message: "Project not found" });

    // 🔴 Emit socket event
    emitToAll("project:updated", { project });

    res.json(project);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
/* DELETE PROJECT */
exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);

    if (!project) return res.status(404).json({ message: "Project not found" });

    // 🔴 Emit socket event
    emitToAll("project:deleted", { projectId: req.params.id });

    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};