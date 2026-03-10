exports.generateTaskPrompt = (goal) => {
  return `
You are a project manager AI.

Break the following project goal into actionable tasks.

Goal:
${goal}

Return response in JSON format like:

[
 { "title": "Task name", "priority": "High", "column": "Todo" }
]

Generate 6 tasks.
`;
};