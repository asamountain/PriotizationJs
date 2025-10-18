import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./tasks.db", (err) => {
  if (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
  console.log("Database connected");
});

console.log("\n🎲 Randomizing importance and urgency values for testing...\n");

// Get all tasks
db.all("SELECT id, name FROM tasks", (err, tasks) => {
  if (err) {
    console.error("Error:", err);
    process.exit(1);
  }

  let updated = 0;
  const total = tasks.length;

  tasks.forEach((task) => {
    // Random values between 1-10
    const importance = Math.floor(Math.random() * 10) + 1;
    const urgency = Math.floor(Math.random() * 10) + 1;

    db.run(
      "UPDATE tasks SET importance = ?, urgency = ? WHERE id = ?",
      [importance, urgency, task.id],
      (err) => {
        if (err) {
          console.error(`Error updating task ${task.id}:`, err);
        } else {
          console.log(`✅ Updated: ${task.name.substring(0, 40)}... (I:${importance}, U:${urgency})`);
        }

        updated++;
        if (updated === total) {
          console.log(`\n✅ Updated ${total} tasks with random priorities!`);
          console.log("🔄 Refresh your browser to see tasks in different quadrants.\n");
          db.close();
        }
      }
    );
  });
});

