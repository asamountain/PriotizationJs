import sqlite3 from "sqlite3";
import pg from 'pg';

const isProduction = process.env.DATABASE_URL;

class Database {
  constructor() {
    this.db = null; // SQLite
    this.pool = null; // PostgreSQL
  }

  async init() {
    if (isProduction) {
      console.log("Connecting to Cloud PostgreSQL...");
      this.pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await this.createTablesPostgres();
    } else {
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database("./tasks.db", (err) => {
          if (err) reject(err);
          else {
            console.log("Connected to Local SQLite");
            this.createTablesSqlite().then(resolve).catch(reject);
          }
        });
      });
    }
  }

  async createTablesPostgres() {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        avatar TEXT,
        provider TEXT DEFAULT 'google',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        importance INTEGER DEFAULT 5,
        urgency INTEGER DEFAULT 5,
        done BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        due_date TEXT,
        link TEXT,
        notes TEXT,
        progress INTEGER,
        category TEXT,
        status TEXT,
        total_time_spent INTEGER DEFAULT 0,
        active_timer_start TEXT,
        pomodoro_count INTEGER DEFAULT 0,
        last_worked_at TEXT,
        icon TEXT DEFAULT 'mdi-checkbox-blank-circle-outline'
      );

      CREATE TABLE IF NOT EXISTS time_logs (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER DEFAULT 0,
        session_type TEXT DEFAULT 'focus',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.pool.query(query);
    
    // Migrations for existing tables
    const migrations = [
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_time_spent INTEGER DEFAULT 0",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS active_timer_start TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pomodoro_count INTEGER DEFAULT 0",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_worked_at TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'mdi-checkbox-blank-circle-outline'"
    ];

    for (const migration of migrations) {
      try {
        await this.pool.query(migration);
      } catch (err) {
        console.warn(`Migration failed: ${migration}`, err.message);
      }
    }

    console.log("PostgreSQL Tables verified");
  }

  async createTablesSqlite() {
    const migrations = [
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT, avatar TEXT, provider TEXT DEFAULT 'google', created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_login TEXT DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, importance INTEGER DEFAULT 5, urgency INTEGER DEFAULT 5, done BOOLEAN DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, parent_id INTEGER NULL, user_id TEXT NULL, FOREIGN KEY (parent_id) REFERENCES tasks(id), FOREIGN KEY (user_id) REFERENCES users(id))`,
      `ALTER TABLE tasks ADD COLUMN due_date TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN link TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN completed_at TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN notes TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN progress INTEGER NULL`,
      `ALTER TABLE tasks ADD COLUMN category TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN status TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN user_id TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN total_time_spent INTEGER DEFAULT 0`,
      `ALTER TABLE tasks ADD COLUMN active_timer_start TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN pomodoro_count INTEGER DEFAULT 0`,
      `ALTER TABLE tasks ADD COLUMN last_worked_at TEXT NULL`,
      `ALTER TABLE tasks ADD COLUMN icon TEXT DEFAULT 'mdi-checkbox-blank-circle-outline'`,
      `CREATE TABLE IF NOT EXISTS time_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NULL, duration INTEGER DEFAULT 0, session_type TEXT DEFAULT 'focus', notes TEXT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE)`
    ];
    
    return new Promise((resolve) => {
      this.db.serialize(() => {
        migrations.forEach(sql => {
          this.db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
              // Ignore duplicate column errors
            }
          });
        });
        resolve();
      });
    });
  }

  async query(text, params) {
    if (this.pool) {
      const res = await this.pool.query(text, params);
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.db.all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  }

  async getTaskData(userId) {
    const query = userId 
      ? "SELECT * FROM tasks WHERE (user_id = $1 OR user_id IS NULL) ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, importance DESC, urgency DESC"
      : "SELECT * FROM tasks WHERE user_id IS NULL ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, importance DESC, urgency DESC";
    
    const finalQuery = this.pool ? query : query.replace('$1', '?');
    const params = userId ? [userId] : [];
    return this.query(finalQuery, params);
  }

  async addTask(task, userId) {
    const importance = Math.round(Number(task.importance) || 5);
    const urgency = Math.round(Number(task.urgency) || 5);
    const totalTime = Math.round(Number(task.total_time_spent) || 0);
    const pomodoros = Math.round(Number(task.pomodoro_count) || 0);

    if (this.pool) {
      const res = await this.pool.query(
        `INSERT INTO tasks (
          name, importance, urgency, user_id, done, link, due_date, 
          notes, parent_id, total_time_spent, pomodoro_count, category, status,
          created_at, completed_at, icon, progress
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
          COALESCE($14, CURRENT_TIMESTAMP), $15, $16, $17) RETURNING id`,
        [
          task.name, importance, urgency, userId || null, !!task.done, 
          task.link || null, task.due_date || null, task.notes || null, 
          task.parent_id || null, totalTime, pomodoros, 
          task.category || null, task.status || null,
          task.created_at || null, task.completed_at || null,
          task.icon || 'mdi-checkbox-blank-circle-outline',
          task.progress || 0
        ]
      );
      return res.rows[0].id;
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          `INSERT INTO tasks (
            name, importance, urgency, user_id, done, link, due_date, 
            notes, parent_id, total_time_spent, pomodoro_count, category, status,
            created_at, completed_at, icon, progress
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            task.name, importance, urgency, userId || null, task.done ? 1 : 0, 
            task.link || null, task.due_date || null, task.notes || null, 
            task.parent_id || null, totalTime, pomodoros, 
            task.category || null, task.status || null,
            task.created_at || null, task.completed_at || null,
            task.icon || 'mdi-checkbox-blank-circle-outline',
            task.progress || 0
          ],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    }
  }

  async modifyTask(task) {
    const importance = Math.round(Number(task.importance) || 5);
    const urgency = Math.round(Number(task.urgency) || 5);
    const q = this.pool
      ? "UPDATE tasks SET name = $1, importance = $2, urgency = $3, icon = $4, progress = $5 WHERE id = $6"
      : "UPDATE tasks SET name = ?, importance = ?, urgency = ?, icon = ?, progress = ? WHERE id = ?";
    await this.query(q, [task.name, importance, urgency, task.icon || 'mdi-checkbox-blank-circle-outline', task.progress || 0, task.id]);
  }

  async deleteTask(id) {
    const q = this.pool ? "DELETE FROM tasks WHERE id = $1" : "DELETE FROM tasks WHERE id = ?";
    await this.query(q, [id]);
  }

  async toggleTaskDone(id) {
    const getQ = this.pool ? "SELECT * FROM tasks WHERE id = $1" : "SELECT * FROM tasks WHERE id = ?";
    const tasks = await this.query(getQ, [id]);
    const task = tasks[0];
    if (!task) return;

    const now = new Date().toISOString();
    const updateQ = task.done 
      ? (this.pool ? "UPDATE tasks SET done = FALSE, completed_at = NULL WHERE id = $1" : "UPDATE tasks SET done = 0, completed_at = NULL WHERE id = ?")
      : (this.pool ? "UPDATE tasks SET done = TRUE, completed_at = $1 WHERE id = $2" : "UPDATE tasks SET done = 1, completed_at = ? WHERE id = ?");
    
    const params = task.done ? [id] : [now, id];
    await this.query(updateQ, params);
    return task;
  }

  async addSubtask(subtask, parentId, userId) {
    return this.addTask({ ...subtask, parent_id: parentId }, userId);
  }

  async updateSubtask(subtask) {
    const importance = Math.round(Number(subtask.importance) || 5);
    const urgency = Math.round(Number(subtask.urgency) || 5);
    const q = this.pool 
      ? "UPDATE tasks SET name = $1, importance = $2, urgency = $3, parent_id = $4, link = $5, due_date = $6, icon = $7, notes = $8, status = $9, progress = $10 WHERE id = $11"
      : "UPDATE tasks SET name = ?, importance = ?, urgency = ?, parent_id = ?, link = ?, due_date = ?, icon = ?, notes = ?, status = ?, progress = ? WHERE id = ?";
    await this.query(q, [subtask.name, importance, urgency, subtask.parent_id, subtask.link, subtask.due_date, subtask.icon || 'mdi-checkbox-blank-circle-outline', subtask.notes, subtask.status, subtask.progress || 0, subtask.id]);
  }

  async updateTaskNotes(taskId, notes) {
    const q = this.pool ? "UPDATE tasks SET notes = $1 WHERE id = $2" : "UPDATE tasks SET notes = ? WHERE id = ?";
    await this.query(q, [notes, taskId]);
  }

  async editTask(task) {
    const importance = Math.round(Number(task.importance) || 5);
    const urgency = Math.round(Number(task.urgency) || 5);
    const q = this.pool
      ? "UPDATE tasks SET name = $1, importance = $2, urgency = $3, link = $4, due_date = $5, notes = $6, status = $7, icon = $8, progress = $9 WHERE id = $10"
      : "UPDATE tasks SET name = ?, importance = ?, urgency = ?, link = ?, due_date = ?, notes = ?, status = ?, icon = ?, progress = ? WHERE id = ?";
    await this.query(q, [task.name, importance, urgency, task.link, task.due_date, task.notes, task.status, task.icon || 'mdi-checkbox-blank-circle-outline', task.progress || 0, task.id]);
  }

  async bulkImportTasks(tasks, userId) {
    const results = { imported: 0, updated: 0, errors: [] };
    const idMap = new Map(); // Map original IDs from CSV to new DB IDs
    const subtasksToUpdate = []; // Queue of subtasks to link once parents are in

    console.log(`Starting bulk import of ${tasks.length} tasks...`);

    // Phase 1: Create all tasks (temporarily without parents to avoid FK errors)
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.name) continue;

      try {
        const existing = await this.query(
          this.pool ? "SELECT id, user_id FROM tasks WHERE name = $1 AND (user_id = $2 OR user_id IS NULL)" : "SELECT id, user_id FROM tasks WHERE name = ? AND (user_id = ? OR user_id IS NULL)",
          [task.name, userId]
        );

        let finalId;
        if (existing.length > 0) {
          finalId = existing[0].id;
          if (userId && existing[0].user_id === null) {
            await this.query(this.pool ? "UPDATE tasks SET user_id = $1 WHERE id = $2" : "UPDATE tasks SET user_id = ? WHERE id = ?", [userId, finalId]);
          }
          results.updated++;
        } else {
          // IMPORTANT: Insert without parent first to avoid FK constraint errors with old CSV IDs
          const taskData = { ...task, parent_id: null, icon: task.icon || 'mdi-checkbox-blank-circle-outline', progress: task.progress || 0 };
          finalId = await this.addTask(taskData, userId);
          results.imported++;
        }

        // Store mapping of CSV ID -> New Database ID
        if (task.id) idMap.set(String(task.id), finalId);
        
        // If this task is a subtask, queue it for hierarchy linking using the mapping
        if (task.parent_id) {
          subtasksToUpdate.push({ taskId: finalId, originalParentId: String(task.parent_id) });
        }
      } catch (err) {
        console.error(`Failed to import row ${i + 1} (${task.name}):`, err.message);
        results.errors.push({ row: i + 1, task: task.name, error: err.message });
      }
    }

    // Phase 2: Rebuild hierarchy using the ID map
    if (subtasksToUpdate.length > 0) {
      console.log(`Rebuilding hierarchy for ${subtasksToUpdate.length} subtasks...`);
      for (const link of subtasksToUpdate) {
        const newParentId = idMap.get(link.originalParentId);
        if (newParentId) {
          try {
            await this.setTaskParent(link.taskId, newParentId);
          } catch (linkErr) {
            console.error(`Failed to link task ${link.taskId} to parent ${newParentId}:`, linkErr.message);
          }
        }
      }
    }

    return results;
  }

  async startTimer(taskId) {
    const now = new Date().toISOString();
    const q = this.pool 
      ? "UPDATE tasks SET active_timer_start = $1, last_worked_at = $2 WHERE id = $3"
      : "UPDATE tasks SET active_timer_start = ?, last_worked_at = ? WHERE id = ?";
    await this.query(q, [now, now, taskId]);
    return { taskId, startTime: now };
  }

  async stopTimer(taskId) {
    const getQ = this.pool ? "SELECT active_timer_start, total_time_spent FROM tasks WHERE id = $1" : "SELECT active_timer_start, total_time_spent FROM tasks WHERE id = ?";
    const tasks = await this.query(getQ, [taskId]);
    const task = tasks[0];
    if (!task || !task.active_timer_start) throw new Error('No active timer');

    const duration = Math.floor((new Date() - new Date(task.active_timer_start)) / 1000);
    const newTotalTime = (task.total_time_spent || 0) + duration;
    const pomodoroIncr = duration >= 1500 ? 1 : 0;

    const upQ = this.pool
      ? "UPDATE tasks SET active_timer_start = NULL, total_time_spent = $1, pomodoro_count = pomodoro_count + $2 WHERE id = $3"
      : "UPDATE tasks SET active_timer_start = NULL, total_time_spent = ?, pomodoro_count = pomodoro_count + ? WHERE id = ?";
    await this.query(upQ, [newTotalTime, pomodoroIncr, taskId]);

    const logQ = this.pool
      ? "INSERT INTO time_logs (task_id, start_time, end_time, duration) VALUES ($1, $2, $3, $4)"
      : "INSERT INTO time_logs (task_id, start_time, end_time, duration) VALUES (?, ?, ?, ?)";
    await this.query(logQ, [taskId, task.active_timer_start, new Date().toISOString(), duration]);

    return { taskId, duration, totalTime: newTotalTime };
  }

  async getTimeLogs(taskId) {
    const q = this.pool ? "SELECT * FROM time_logs WHERE task_id = $1 ORDER BY created_at DESC" : "SELECT * FROM time_logs WHERE task_id = ? ORDER BY created_at DESC";
    return this.query(q, [taskId]);
  }

  async getActiveTimers() {
    const q = "SELECT id, name, active_timer_start FROM tasks WHERE active_timer_start IS NOT NULL";
    return this.query(q, []);
  }

  async setTaskParent(taskId, parentId) {
    const q = parentId === null 
      ? (this.pool ? "UPDATE tasks SET parent_id = NULL WHERE id = $1" : "UPDATE tasks SET parent_id = NULL WHERE id = ?")
      : (this.pool ? "UPDATE tasks SET parent_id = $1 WHERE id = $2" : "UPDATE tasks SET parent_id = ? WHERE id = ?");
    const params = parentId === null ? [taskId] : [parentId, taskId];
    await this.query(q, params);
  }

  async updateTaskStatus(taskId, status) {
    const q = this.pool ? "UPDATE tasks SET status = $1 WHERE id = $2" : "UPDATE tasks SET status = ? WHERE id = ?";
    await this.query(q, [status, taskId]);
  }

  async upsertUser(user) {
    const now = new Date().toISOString();
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO users (id, email, name, avatar, provider, last_login)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(id) DO UPDATE SET
         email = EXCLUDED.email, name = EXCLUDED.name, avatar = EXCLUDED.avatar, last_login = EXCLUDED.last_login`,
        [user.id, user.email, user.name, user.avatar, user.provider || 'google', now]
      );
    } else {
      await this.query(
        `INSERT INTO users (id, email, name, avatar, provider, last_login)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
         email = excluded.email, name = excluded.name, avatar = excluded.avatar, last_login = excluded.last_login`,
        [user.id, user.email, user.name, user.avatar, user.provider || 'google', now]
      );
    }
    return user;
  }
}

const database = new Database();
export const getTaskData = (userId) => database.getTaskData(userId);
export const addTask = (task, userId) => database.addTask(task, userId);
export const modifyTask = (task) => database.modifyTask(task);
export const deleteTask = (id) => database.deleteTask(id);
export const toggleTaskDone = (id) => database.toggleTaskDone(id);
export const addSubtask = (s, p, u) => database.addSubtask(s, p, u);
export const updateSubtask = (s) => database.updateSubtask(s);
export const updateTaskNotes = (id, n) => database.updateTaskNotes(id, n);
export const editTask = (t) => database.editTask(t);
export const bulkImportTasks = (t, u) => database.bulkImportTasks(t, u);
export const startTimer = (id) => database.startTimer(id);
export const stopTimer = (id) => database.stopTimer(id);
export const getTimeLogs = (id) => database.getTimeLogs(id);
export const getActiveTimers = () => database.getActiveTimers();
export const setTaskParent = (id, p) => database.setTaskParent(id, p);
export const updateTaskStatus = (id, s) => database.updateTaskStatus(id, s);
export const upsertUser = (u) => database.upsertUser(u);
export const initDatabase = () => database.init();
export default database;
