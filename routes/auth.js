const express = require("express");
const router = express.Router();
const db = require("../db");

const bcrypt = require("bcrypt");

router.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashedPassword],
    function (err) {
      if (err) {
        return res.json({ message: "User already exists" });
      }

      res.json({ message: "User created successfully" });
    }
  );
});
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        return res.json({ message: "Error" });
      }

      if (!user) {
        return res.json({ message: "User not found" });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.json({ message: "Wrong password" });
      }

      res.json({ message: "Login successful", userId: user.id });
    }
  );
});

module.exports = router;