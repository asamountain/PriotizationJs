import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./tasks.db", (err) => {
  if (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
  console.log("Database connected");
});

console.log("\n🔍 Checking your imported tasks...\n");

db.all("SELECT id, name, importance, urgency, done FROM tasks LIMIT 10", (err, rows) => {
  if (err) {
    console.error("Error:", err);
    process.exit(1);
  }

  console.log("Sample of your tasks:");
  console.table(rows);

  console.log("\n📊 Analysis:");
  
  db.get("SELECT COUNT(*) as total, AVG(importance) as avg_imp, AVG(urgency) as avg_urg FROM tasks", (err, stats) => {
    if (err) {
      console.error("Error:", err);
      process.exit(1);
    }

    console.log(`Total tasks: ${stats.total}`);
    console.log(`Average importance: ${stats.avg_imp}`);
    console.log(`Average urgency: ${stats.avg_urg}`);

    if (stats.avg_imp === 5 && stats.avg_urg === 5) {
      console.log("\n⚠️  WARNING: All tasks have default values (5, 5)");
      console.log("This means your Google Sheets 'Important' and 'Urgency' columns are EMPTY!\n");
      
      console.log("💡 SOLUTIONS:\n");
      console.log("1️⃣  Fill in the 'Important' and 'Urgency' columns in your Google Sheet");
      console.log("   - Open your Google Sheet");
      console.log("   - Add values 0-10 in the 'Important' column");
      console.log("   - Add values 0-10 in the 'Urgency' column");
      console.log("   - Export as CSV again");
      console.log("   - Re-import\n");
      
      console.log("2️⃣  Edit tasks manually in the app");
      console.log("   - Click the pencil icon on each task");
      console.log("   - Adjust importance and urgency sliders\n");
      
      console.log("3️⃣  Auto-assign random values (for testing)");
      console.log("   - Run: npm run randomize-priorities\n");
    } else {
      console.log("\n✅ Your tasks have varied importance/urgency values!");
      console.log("They should appear in different quadrants on the chart.\n");
    }

    db.close();
  });
});

