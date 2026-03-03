const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const boardRoutes = require("./routes/board.routes");
const columnRoutes = require("./routes/column.routes");
const taskRoutes = require("./routes/task.routes");
const userRoutes = require("./routes/user.routes.js");
const activityRoutes = require("./routes/activity.routes");


const app = express();
const helmet = require("helmet");

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": [
          "'self'",
          "https://accounts.google.com",
          "https://apis.google.com"
        ],
        "frame-src": [
          "'self'",
          "https://accounts.google.com"
        ],
        "connect-src": [
          "'self'",
          "http://localhost:5173",
          "https://task-855.pages.dev",
          "https://accounts.google.com"
        ],
      },
    },
  })
);

const allowedOrigins = [
  "http://localhost:5173",
  "https://task-855.pages.dev"
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/columns", columnRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/activity", activityRoutes);


module.exports = app;
