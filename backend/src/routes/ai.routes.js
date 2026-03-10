const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");

router.post("/generate-tasks", aiController.generateTasks);

module.exports = router;