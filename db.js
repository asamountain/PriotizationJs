import sqlite3 from "sqlite3";

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      try {
        this.db = new sqlite3.Database("./tasks.db", (err) => {
          if (err) {
            console.error("Database connection failed:", err);
            reject(err);
            return;
          }
          console.log("Database connected successfully");
          this.createTables().then(resolve).catch(reject);
        });
      } catch (error) {
        console.error("Database initialization failed:", error);
        reject(error);
      }
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      // Define table creation and migrations in a single transaction
      const migrations = [
        `CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          importance INTEGER DEFAULT 5,
          urgency INTEGER DEFAULT 5,
          done BOOLEAN DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          parent_id INTEGER NULL,
          user_id TEXT NULL,
          FOREIGN KEY (parent_id) REFERENCES tasks(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        // Add migrations for new columns
        `ALTER TABLE tasks ADD COLUMN due_date TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN link TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN completed_at TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN notes TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN progress INTEGER NULL`,
        `ALTER TABLE tasks ADD COLUMN category TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN status TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN user_id TEXT NULL`,
        // Pomodoro/Time tracking columns
        `ALTER TABLE tasks ADD COLUMN total_time_spent INTEGER DEFAULT 0`,
        `ALTER TABLE tasks ADD COLUMN active_timer_start TEXT NULL`,
        `ALTER TABLE tasks ADD COLUMN pomodoro_count INTEGER DEFAULT 0`,
        `ALTER TABLE tasks ADD COLUMN last_worked_at TEXT NULL`,
        // Create time_logs table for detailed session tracking
        `CREATE TABLE IF NOT EXISTS time_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NULL,
          duration INTEGER DEFAULT 0,
          session_type TEXT DEFAULT 'focus',
          notes TEXT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )`,
        // Create users table for OAuth
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT,
          avatar TEXT,
          provider TEXT DEFAULT 'google',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          last_login TEXT DEFAULT CURRENT_TIMESTAMP
        )`
      ];
      
      this.db.serialize(() => {
        migrations.forEach(sql => {
          this.db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
              console.error("Migration failed:", err);
              reject(err);
              return;
            }
          });
        });
        resolve();
        console.log("Tables and migrations completed successfully");
      });
    });
  }

  // Your existing CRUD operations here
  async getTaskData(userId) {
    return new Promise((resolve, reject) => {
      // If userId is provided, show both their tasks AND anonymous tasks (to prevent disappearance)
      const query = userId 
        ? "SELECT * FROM tasks WHERE (user_id = ? OR user_id IS NULL) ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, importance DESC, urgency DESC"
        : "SELECT * FROM tasks WHERE user_id IS NULL ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, importance DESC, urgency DESC";
      
      const params = userId ? [userId] : [];

      this.db.all(query, params, (err, rows) => {
          if (err) {
            console.error("Error fetching tasks:", err);
            reject(err);
            return;
          }
          resolve(rows);
          console.log(`Tasks fetched for user ${userId || 'anonymous'}:`, rows.length);
        }
      );
    });
  }

  async addTask(task, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO tasks (name, importance, urgency, user_id) VALUES (?, ?, ?, ?)",
        [task.name, task.importance, task.urgency, userId || null],
        function (err) {
          if (err) {
            console.error("Error adding task:", err);
            reject(err);
            return;
          }
          resolve(this.lastID);
          console.log("Task added:", this.lastID, "for user:", userId || 'anonymous');
        }
      );
    });
  }

  async modifyTask(task) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE tasks SET name = ?, importance = ?, urgency = ? WHERE id = ?",
        [task.name, task.importance, task.urgency, task.id],
        (err) => {
          if (err) {
            console.error("Error modifying task:", err);
            reject(err);
            return;
          }
          resolve();
          console.log("Task modified:", task.id);
        }
      );
    });
  }
  async deleteTask(id) {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM tasks WHERE id = ?", [id], (err) => {
        if (err) {
          console.error("Error deleting task:", err);
          reject(err);
          return;
        }
        resolve();
        console.log("Task deleted:", id);
      });
    });
  }

  async toggleTaskDone(id) {
    console.log('Database.toggleTaskDone called for task ID:', id);
    
    return new Promise((resolve, reject) => {
      // First, get the current task to determine its name for notification
      this.db.get("SELECT * FROM tasks WHERE id = ?", [id], (err, task) => {
        if (err) {
          console.error("Error getting task for toggle:", err);
          reject(err);
          return;
        }
        
        if (!task) {
          const notFoundError = new Error(`Task with ID ${id} not found`);
          console.error(notFoundError);
          reject(notFoundError);
          return;
        }
        
        // Now that we have the task, update its done status
        // Also update completion_time for audit trail
        const now = new Date().toISOString();
        const updateQuery = task.done 
          ? "UPDATE tasks SET done = 0, completed_at = NULL WHERE id = ?" 
          : "UPDATE tasks SET done = 1, completed_at = ? WHERE id = ?";
        
        const params = task.done ? [id] : [now, id];
        
        this.db.run(updateQuery, params, (updateErr) => {
          if (updateErr) {
            console.error("Error toggling task done status:", updateErr);
            reject(updateErr);
            return;
          }
          
          // Task was successfully toggled
          console.log(`Task ${task.name} ${task.done ? 'reopened' : 'completed'}`);
          resolve(task);
        });
      });
    });
  }

  // Add a subtask to a parent task
  async addSubtask(subtask, parentId, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO tasks (name, importance, urgency, parent_id, link, due_date, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [subtask.name, subtask.importance, subtask.urgency, parentId, subtask.link, subtask.due_date, userId || null],
        function (err) {
          if (err) {
            console.error("Error adding subtask:", err);
            reject(err);
            return;
          }
          resolve(this.lastID);
          console.log("Subtask added:", this.lastID, "to parent:", parentId, "for user:", userId || 'anonymous');
        }
      );
    });
  }

  async updateSubtask(subtask) {
    console.log("DATABASE: Updating subtask with ID:", subtask.id);
    console.log("DATABASE: Subtask link value being saved:", subtask.link);
    console.log("DATABASE: Subtask link type:", typeof subtask.link);
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.error("Database connection not available");
        return reject(new Error("Database connection not available"));
      }
      
      try {
        this.db.run(
          "UPDATE tasks SET name = ?, importance = ?, urgency = ?, parent_id = ?, link = ?, due_date = ? WHERE id = ?",
          [subtask.name, subtask.importance, subtask.urgency, subtask.parent_id, subtask.link, subtask.due_date, subtask.id],
          function(err) {
            if (err) {
              console.error("Error updating subtask:", err);
              reject(err);
              return;
            }
            
            // Success - resolve with number of rows changed
            resolve(this.changes);
            console.log("Subtask updated successfully:", subtask.id, "Changes:", this.changes);
            console.log("Updated link value:", subtask.link);
          }
        );
      } catch (error) {
        console.error("Exception during subtask update:", error);
        reject(error);
      }
    });
  }

  async updateTaskNotes(taskId, notes) {
    console.log("DATABASE: Updating notes for task ID:", taskId);
    console.log("DATABASE: Notes content being saved:", notes);
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        console.error("Database connection not available");
        return reject(new Error("Database connection not available"));
      }
      
      try {
        this.db.run(
          "UPDATE tasks SET notes = ? WHERE id = ?",
          [notes, taskId],
          function(err) {
            if (err) {
              console.error("Error updating task notes:", err);
              reject(err);
              return;
            }
            
            // Success - resolve with number of rows changed
            resolve(this.changes);
            console.log("Task notes updated successfully:", taskId, "Changes:", this.changes);
            
            // Verify the update worked by querying the record
            this.db.get("SELECT * FROM tasks WHERE id = ?", [taskId], (err, row) => {
              if (err) {
                console.error("Error verifying notes update:", err);
                return;
              }
              console.log("Task after notes update:", row);
              console.log("Verified notes value in database:", row?.notes);
            });
          }.bind(this) // Important: bind this to access db in callback
        );
      } catch (error) {
        console.error("Exception during notes update:", error);
        reject(error);
      }
    });
  }

  async editTask(task) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE tasks SET name = ?, importance = ?, urgency = ?, link = ?, due_date = ?, notes = ?, status = ? WHERE id = ?",
        [task.name, task.importance, task.urgency, task.link, task.due_date, task.notes, task.status, task.id],
        function (err) {
          if (err) {
            console.error("Error editing task:", err);
            reject(err);
            return;
          }
          resolve(this.changes);
          console.log("Task edited:", task.id, "Changes:", this.changes);
        }
      );
    });
  }

  // Bulk import tasks from CSV
  async bulkImportTasks(tasks, userId) {
    return new Promise((resolve, reject) => {
      const results = {
        imported: 0,
        updated: 0,
        errors: []
      };

      // Capture db reference to avoid context issues
      const db = this.db;

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        let completed = 0;
        const total = tasks.length;

        tasks.forEach((task, index) => {
          // Check if task has required fields
          if (!task.name) {
            results.errors.push({ row: index + 1, error: "Missing task name" });
            completed++;
            if (completed === total) {
              db.run("COMMIT", (err) => {
                if (err) reject(err);
                else resolve(results);
              });
            }
            return;
          }

          // Set defaults for missing values
          // Handle empty strings and undefined/null values
          const importanceNum = Number(task.importance);
          const urgencyNum = Number(task.urgency);
          const importance = (task.importance && !isNaN(importanceNum)) ? importanceNum : 5;
          const urgency = (task.urgency && !isNaN(urgencyNum)) ? urgencyNum : 5;
          const done = task.done === "true" || task.done === "1" || task.done === 1 || task.done === true ? 1 : 0;
          const link = task.link || null;
          const due_date = task.due_date || null;
          const notes = task.notes || null;
          const parent_id = task.parent_id || null;
          const progress = task.progress ? Number(task.progress) : null;
          const category = task.category || null;
          const status = task.status || null;

          // Check for duplicates or anonymous tasks to claim
          db.get(
            "SELECT id, user_id FROM tasks WHERE name = ?",
            [task.name],
            (err, existingTask) => {
              if (err) {
                console.error("Error checking for duplicate:", err);
                results.errors.push({ row: index + 1, task: task.name, error: err.message });
                completed++;
                if (completed === total) finalizeImport();
                return;
              }

              // If task exists
              if (existingTask) {
                // If I am logged in and the existing task is anonymous, claim it
                if (userId && existingTask.user_id === null) {
                  db.run("UPDATE tasks SET user_id = ? WHERE id = ?", [userId, existingTask.id]);
                  results.updated++;
                } else if (existingTask.user_id === userId || (existingTask.user_id === null && userId === null)) {
                  // Already exists for me, just skip/update
                  results.updated++;
                } else {
                  // It belongs to someone else, so we DO create a new one for this user
                  insertNewTask();
                  return;
                }
                completed++;
                if (completed === total) finalizeImport();
                return;
              }

              insertNewTask();

              function insertNewTask() {
                db.run(
                  "INSERT INTO tasks (name, importance, urgency, done, link, due_date, notes, parent_id, progress, category, status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  [task.name, importance, urgency, done, link, due_date, notes, parent_id, progress, category, status, userId || null],
                  function (insertErr) {
                    if (insertErr) {
                      console.error("Error importing task:", insertErr);
                      results.errors.push({ row: index + 1, task: task.name, error: insertErr.message });
                    } else {
                      results.imported++;
                    }
                    completed++;
                    if (completed === total) finalizeImport();
                  }
                );
              }
            }
          );
        });

        const finalizeImport = () => {
          db.run("COMMIT", (commitErr) => {
            if (commitErr) {
              console.error("Transaction commit failed:", commitErr);
              reject(commitErr);
            } else {
              console.log("Bulk import completed:", results);
              resolve(results);
            }
          });
        };

        // Handle empty array case
        if (total === 0) {
          db.run("COMMIT", (err) => {
            if (err) reject(err);
            else resolve(results);
          });
        }
      });
    });
  }

  // Timer/Pomodoro methods
  async startTimer(taskId) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(
        `UPDATE tasks SET active_timer_start = ?, last_worked_at = ? WHERE id = ?`,
        [now, now, taskId],
        function (err) {
          if (err) {
            console.error("Error starting timer:", err);
            reject(err);
            return;
          }
          resolve({ taskId, startTime: now });
        }
      );
    });
  }

  async stopTimer(taskId) {
    return new Promise((resolve, reject) => {
      // First, get the current timer start time
      this.db.get(
        `SELECT active_timer_start, total_time_spent FROM tasks WHERE id = ?`,
        [taskId],
        (err, task) => {
          if (err || !task || !task.active_timer_start) {
            reject(err || new Error('No active timer'));
            return;
          }

          const startTime = new Date(task.active_timer_start);
          const endTime = new Date();
          const duration = Math.floor((endTime - startTime) / 1000); // seconds
          const newTotalTime = (task.total_time_spent || 0) + duration;

          // Update task and create time log
          this.db.serialize(() => {
            // Update task
            this.db.run(
              `UPDATE tasks SET 
                active_timer_start = NULL, 
                total_time_spent = ?,
                pomodoro_count = pomodoro_count + ?
              WHERE id = ?`,
              [newTotalTime, duration >= 1500 ? 1 : 0, taskId] // 25 min = 1 pomodoro
            );

            // Log the session
            this.db.run(
              `INSERT INTO time_logs (task_id, start_time, end_time, duration, session_type)
              VALUES (?, ?, ?, ?, ?)`,
              [taskId, task.active_timer_start, endTime.toISOString(), duration, 'focus'],
              function (err) {
                if (err) {
                  reject(err);
                  return;
                }
                resolve({ taskId, duration, totalTime: newTotalTime, logId: this.lastID });
              }
            );
          });
        }
      );
    });
  }

  async getTimeLogs(taskId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM time_logs WHERE task_id = ? ORDER BY created_at DESC`,
        [taskId],
        (err, rows) => {
          if (err) {
            console.error("Error fetching time logs:", err);
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
  }

  async getActiveTimers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, name, active_timer_start FROM tasks WHERE active_timer_start IS NOT NULL`,
        [],
        (err, rows) => {
          if (err) {
            console.error("Error fetching active timers:", err);
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });
  }

  // Set parent for a task (creates subtask relationship)
  // Preserves ALL timer data - only updates parent_id
  async setTaskParent(taskId, parentId) {
    console.log(`DATABASE: Setting task ${taskId} parent to ${parentId}`);
    return new Promise((resolve, reject) => {
      // Use COALESCE or explicit NULL handling
      const query = parentId === null 
        ? "UPDATE tasks SET parent_id = NULL WHERE id = ?"
        : "UPDATE tasks SET parent_id = ? WHERE id = ?";
      
      const params = parentId === null ? [taskId] : [parentId, taskId];

      this.db.run(query, params, function (err) {
          if (err) {
            console.error("Error setting task parent:", err);
            reject(err);
            return;
          }
          console.log(`DATABASE: Task ${taskId} parent set to ${parentId}. Rows affected: ${this.changes}`);
          resolve({ taskId, parentId, changes: this.changes });
        }
      );
    });
  }

  async updateTaskStatus(taskId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE tasks SET status = ? WHERE id = ?`,
        [status, taskId],
        function (err) {
          if (err) {
            console.error("Error updating task status:", err);
            reject(err);
            return;
          }
          resolve({ taskId, status, changes: this.changes });
        }
      );
    });
  }

  async upsertUser(user) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      this.db.run(
        `INSERT INTO users (id, email, name, avatar, provider, last_login)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         avatar = excluded.avatar,
         last_login = excluded.last_login`,
        [user.id, user.email, user.name, user.avatar, user.provider || 'google', now],
        function (err) {
          if (err) {
            console.error("Error upserting user:", err);
            reject(err);
            return;
          }
          resolve(user);
        }
      );
    });
  }
}

const database = new Database();

// Add these exports back
export const getTaskData = (...args) => database.getTaskData(...args);
export const addTask = (...args) => database.addTask(...args);
export const modifyTask = (...args) => database.modifyTask(...args);
export const deleteTask = (...args) => database.deleteTask(...args);
export const toggleTaskDone = (...args) => database.toggleTaskDone(...args);
export const addSubtask = (...args) => database.addSubtask(...args);
export const updateSubtask = (...args) => database.updateSubtask(...args);
export const updateTaskNotes = (...args) => database.updateTaskNotes(...args);
export const editTask = (...args) => database.editTask(...args);
export const bulkImportTasks = (...args) => database.bulkImportTasks(...args);
export const startTimer = (...args) => database.startTimer(...args);
export const stopTimer = (...args) => database.stopTimer(...args);
export const getTimeLogs = (...args) => database.getTimeLogs(...args);
export const getActiveTimers = (...args) => database.getActiveTimers(...args);
export const setTaskParent = (...args) => database.setTaskParent(...args);
export const updateTaskStatus = (...args) => database.updateTaskStatus(...args);
export const upsertUser = (...args) => database.upsertUser(...args);
export const initDatabase = async () => {
  try {
    await database.init();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
};

export default database;