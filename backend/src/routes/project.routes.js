const express = require("express");
const router = express.Router();
const projectController = require("../controllers/project.controller");

router.post("/", projectController.createProject);      // CREATE
router.get("/", projectController.getProjects);         // READ ALL
router.get("/:id", projectController.getProjectById);   // READ ONE
router.put("/:id", projectController.updateProject);    // UPDATE
router.delete("/:id", projectController.deleteProject); // DELETE

module.exports = router;
