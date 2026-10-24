
const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

async function hasProjectAccess(projectId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM project_members
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return result.rowCount > 0;
}

async function hasTaskAccess(taskId, userId) {
  const result = await pool.query(
    `SELECT t.project_id
     FROM tasks t
     JOIN project_members pm ON pm.project_id = t.project_id
     WHERE t.id = $1 AND pm.user_id = $2`,
    [taskId, userId]
  );
  return result.rows[0]?.project_id ?? null;
}

router.get("/project/:projectId", async (req, res) => {
  try {
    if (!(await hasProjectAccess(req.params.projectId, req.user.id))) {
      return res.status(403).json({ message: "Project access denied." });
    }

    const result = await pool.query(
      `SELECT t.*, u.name AS assignee_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [req.params.projectId]
    );

    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Unable to load tasks." });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      project_id, title, description = "",
      status = "todo", priority = "medium",
      assigned_to = null, due_date = null
    } = req.body;

    if (!project_id || !title?.trim()) {
      return res.status(400).json({
        message: "Project and task title are required."
      });
    }

    if (!(await hasProjectAccess(project_id, req.user.id))) {
      return res.status(403).json({ message: "Project access denied." });
    }

    if (!["todo", "in_progress", "done"].includes(status) ||
        !["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ message: "Invalid status or priority." });
    }

    if (assigned_to) {
      const member = await pool.query(
        `SELECT 1 FROM project_members
         WHERE project_id = $1 AND user_id = $2`,
        [project_id, assigned_to]
      );

      if (!member.rowCount) {
        return res.status(400).json({
          message: "Assignee must be a project member."
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks
       (project_id, title, description, status, priority,
        assigned_to, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        project_id, title.trim(), description,
        status, priority, assigned_to, due_date, req.user.id
      ]
    );

    const task = result.rows[0];
    req.app.get("io").to(`project:${project_id}`).emit("task:created", task);

    res.status(201).json(task);
  } catch (error) {
    if (error.code === "23503" || error.code === "22007") {
      return res.status(400).json({ message: "Invalid task details." });
    }

    console.error(error.message);
    res.status(500).json({ message: "Unable to create task." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const projectId = await hasTaskAccess(req.params.id, req.user.id);

    if (!projectId) {
      return res.status(404).json({ message: "Task not found." });
    }

    const allowed = ["title", "description", "status", "priority", "assigned_to", "due_date"];
    const updates = Object.entries(req.body)
      .filter(([key]) => allowed.includes(key));

    if (!updates.length) {
      return res.status(400).json({ message: "No valid fields supplied." });
    }

    const values = updates.map(([, value]) => value);
    const setClause = updates.map(
      ([key], index) => `${key} = $${index + 1}`
    );

    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE tasks SET ${setClause.join(", ")}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    const task = result.rows[0];
    req.app.get("io").to(`project:${projectId}`).emit("task:updated", task);

    res.json(task);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Unable to update task." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const projectId = await hasTaskAccess(req.params.id, req.user.id);

    if (!projectId) {
      return res.status(404).json({ message: "Task not found." });
    }

    await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);

    req.app.get("io").to(`project:${projectId}`).emit("task:deleted", {
      id: Number(req.params.id)
    });

    res.json({ message: "Task deleted successfully." });
  } catch {
    res.status(500).json({ message: "Unable to delete task." });
  }
});

router.get("/:id/comments", async (req, res) => {
  try {
    if (!(await hasTaskAccess(req.params.id, req.user.id))) {
      return res.status(404).json({ message: "Task not found." });
    }

    const result = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.name AS author
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1 ORDER BY c.created_at`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Unable to load comments." });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const projectId = await hasTaskAccess(req.params.id, req.user.id);
    const content = req.body.content?.trim();

    if (!projectId) {
      return res.status(404).json({ message: "Task not found." });
    }

    if (!content || content.length > 3000) {
      return res.status(400).json({
        message: "Comment must contain 1–3000 characters."
      });
    }

    const result = await pool.query(
      `INSERT INTO comments (task_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, req.user.id, content]
    );

    const comment = result.rows[0];
    req.app.get("io").to(`project:${projectId}`).emit("comment:created", comment);

    res.status(201).json(comment);
  } catch {
    res.status(500).json({ message: "Unable to add comment." });
  }
});

module.exports = router;
