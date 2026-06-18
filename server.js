const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("frontend"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const db = new sqlite3.Database("chat.db", (err) => {
  if (err) {
    console.log("Database error:", err);
  } else {
    console.log("SQLite connected");
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL,
      username TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// SIGNUP
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ message: "Username and password required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword],
      function (err) {
        if (err) {
          return res.json({ message: "User already exists" });
        }

        res.json({ message: "Signup success" });
      }
    );
  } catch (err) {
    res.json({ message: "Signup failed" });
  }
});

// LOGIN
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ message: "Username and password required" });
  }

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        return res.json({ message: "Login failed" });
      }

      if (!user) {
        return res.json({ message: "User not found" });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.json({ message: "Wrong password" });
      }

      res.json({ message: "Login success", username: user.username });
    }
  );
});

// GET USERS
app.get("/users", (req, res) => {
  db.all("SELECT username FROM users ORDER BY username", [], (err, rows) => {
    if (err) {
      return res.json([]);
    }

    res.json(rows);
  });
});

// PRIVATE CHAT HISTORY
app.get("/messages/:user1/:user2", (req, res) => {
  const { user1, user2 } = req.params;

  db.all(
    `
    SELECT * FROM messages
    WHERE (sender = ? AND receiver = ?)
       OR (sender = ? AND receiver = ?)
    ORDER BY timestamp
    `,
    [user1, user2, user2, user1],
    (err, rows) => {
      if (err) {
        return res.json([]);
      }

      res.json(rows);
    }
  );
});

// CREATE GROUP
app.post("/groups", (req, res) => {
  const { name, members } = req.body;

  if (!name || !Array.isArray(members) || members.length === 0) {
    return res.json({ message: "Group name and members required" });
  }

  db.run("INSERT INTO groups (name) VALUES (?)", [name], function (err) {
    if (err) {
      return res.json({ message: "Group creation failed" });
    }

    const groupId = this.lastID;

    const uniqueMembers = [...new Set(members)];

    uniqueMembers.forEach((member) => {
      db.run(
        "INSERT INTO group_members (group_id, username) VALUES (?, ?)",
        [groupId, member]
      );
    });

    res.json({ message: "Group created", groupId });
  });
});

// GET GROUPS FOR USER
app.get("/groups/:username", (req, res) => {
  const { username } = req.params;

  db.all(
    `
    SELECT groups.id, groups.name
    FROM groups
    JOIN group_members ON groups.id = group_members.group_id
    WHERE group_members.username = ?
    ORDER BY groups.id DESC
    `,
    [username],
    (err, rows) => {
      if (err) {
        return res.json([]);
      }

      res.json(rows);
    }
  );
});

// GROUP CHAT HISTORY
app.get("/group-messages/:groupId", (req, res) => {
  const { groupId } = req.params;

  db.all(
    `
    SELECT * FROM group_messages
    WHERE group_id = ?
    ORDER BY timestamp
    `,
    [groupId],
    (err, rows) => {
      if (err) {
        return res.json([]);
      }

      res.json(rows);
    }
  );
});

const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join", (username) => {
    onlineUsers[username] = socket.id;
    console.log("Online users:", onlineUsers);
  });

  socket.on("send_message", (data) => {
    const { sender, receiver, text } = data;

    if (!sender || !receiver || !text) return;

    db.run(
      "INSERT INTO messages (sender, receiver, text) VALUES (?, ?, ?)",
      [sender, receiver, text]
    );

    const receiverSocket = onlineUsers[receiver];
    const senderSocket = onlineUsers[sender];

    if (receiverSocket) {
      io.to(receiverSocket).emit("receive_message", data);
    }

    if (senderSocket) {
      io.to(senderSocket).emit("receive_message", data);
    }
  });

  socket.on("join_group", (groupId) => {
    socket.join("group_" + groupId);
  });

  socket.on("send_group_message", (data) => {
    const { groupId, sender, text } = data;

    if (!groupId || !sender || !text) return;

    db.run(
      "INSERT INTO group_messages (group_id, sender, text) VALUES (?, ?, ?)",
      [groupId, sender, text]
    );

    io.to("group_" + groupId).emit("receive_group_message", data);
  });

  socket.on("disconnect", () => {
    for (const username in onlineUsers) {
      if (onlineUsers[username] === socket.id) {
        delete onlineUsers[username];
        break;
      }
    }

    console.log("Disconnected:", socket.id);
  });
});

server.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});