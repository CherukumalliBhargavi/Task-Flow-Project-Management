
require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const pool = require("./db");

const app = express();
const server = http.createServer(app);

const io = new Server(server);
app.set("io", io);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const frontendDir = path.resolve(__dirname, "../Frontend");
app.use(express.static(frontendDir));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/tasks", require("./routes/tasks"));

io.on("connection", (socket) => {
  socket.on("project:join", async (projectId, callback) => {
    try {
      const token = socket.handshake.auth?.token;
      const jwt = require("jsonwebtoken");

      if (!token) throw new Error("Authentication required.");

      const user = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        `SELECT 1 FROM project_members
         WHERE project_id = $1 AND user_id = $2`,
        [projectId, user.id]
      );

      if (!result.rowCount) throw new Error("Project access denied.");

      socket.join(`project:${projectId}`);
      if (typeof callback === "function") callback({ ok: true });
    } catch {
      if (typeof callback === "function") {
        callback({ ok: false, message: "Unable to join project." });
      }
    }
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Connect Sphere running at http://localhost:${PORT}`);
});

pool.query("SELECT 1")
  .then(() => console.log("PostgreSQL connection successful."))
  .catch((error) => console.error("PostgreSQL connection failed:", error.message));
