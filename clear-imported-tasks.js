import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./tasks.db", (err) => {
  if (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
  console.log("Database connected");
});

// Delete all tasks except the first 3 (your original test tasks)
db.run("DELETE FROM tasks WHERE id > 3", function(err) {
  if (err) {
    console.error("Error deleting tasks:", err);
    process.exit(1);
  }
  
  console.log(`✅ Deleted ${this.changes} imported tasks`);
  console.log("✅ Your original test tasks (IDs 1-3) are preserved");
  console.log("\nNow you can re-import your CSV file with the correct importance/urgency values!");
  
  db.close();
  process.exit(0);
});

