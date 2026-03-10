const { generateTasksFromAI } = require("../services/ai.service");

exports.generateTasks = async (req, res) => {
  try {
    const { goal } = req.body;

    if (!goal) {
      return res.status(400).json({
        message: "Goal is required"
      });
    }

    const tasks = await generateTasksFromAI(goal);

    res.json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "AI task generation failed"
    });
  }
};