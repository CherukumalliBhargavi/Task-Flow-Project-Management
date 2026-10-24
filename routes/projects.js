
const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.owner_id, p.created_at
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Unable to load projects." });
  }
});

router.post("/", async (req, res) => {
  const { name, description = "" } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: "Project name is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO projects (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description, req.user.id]
    );

    const project = result.rows[0];

    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [project.id, req.user.id]
    );

    await client.query("COMMIT");
    res.status(201).json(project);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error.message);
    res.status(500).json({ message: "Unable to create project." });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM projects
       WHERE id = $1 AND owner_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        message: "Project not found or you are not its owner."
      });
    }

    res.json({ message: "Project deleted successfully." });
  } catch {
    res.status(500).json({ message: "Unable to delete project." });
  }
});

module.exports = router;
