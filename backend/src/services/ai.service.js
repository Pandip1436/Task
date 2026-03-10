const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

exports.generateTasksFromAI = async (projectTitle) => {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "user",
        content: `Generate 5 tasks for project "${projectTitle}". 
Return ONLY a JSON array like:
["Task1","Task2","Task3"]`,
      },
    ],
  });

  const content = response.choices[0].message.content;

  return JSON.parse(content);
};