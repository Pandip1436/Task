// server.js — entry point
require("dotenv").config();
const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 3000;

connectDB();

// Wrap Express in a plain HTTP server so Socket.IO can attach to it
const httpServer = http.createServer(app);


// Boot Socket.IO
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_USER:", process.env.EMAIL_PASS);
    console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
});