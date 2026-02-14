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
        last_worked_at TEXT
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
    
    // SQLite uses ?, PG uses $1
    const finalQuery = this.pool ? query : query.replace('$1', '?');
    const params = userId ? [userId] : [];
    return this.query(finalQuery, params);
  }

  async addTask(task, userId) {
    if (this.pool) {
      const res = await this.pool.query(
        "INSERT INTO tasks (name, importance, urgency, user_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [task.name, task.importance, task.urgency, userId || null]
      );
      return res.rows[0].id;
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          "INSERT INTO tasks (name, importance, urgency, user_id) VALUES (?, ?, ?, ?)",
          [task.name, task.importance, task.urgency, userId || null],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    }
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

  async updateSubtask(subtask) {
    const q = this.pool 
      ? "UPDATE tasks SET name = $1, importance = $2, urgency = $3, parent_id = $4, link = $5, due_date = $6 WHERE id = $7"
      : "UPDATE tasks SET name = ?, importance = ?, urgency = ?, parent_id = ?, link = ?, due_date = ? WHERE id = ?";
    await this.query(q, [subtask.name, subtask.importance, subtask.urgency, subtask.parent_id, subtask.link, subtask.due_date, subtask.id]);
  }

  async updateTaskNotes(taskId, notes) {
    const q = this.pool ? "UPDATE tasks SET notes = $1 WHERE id = $2" : "UPDATE tasks SET notes = ? WHERE id = ?";
    await this.query(q, [notes, taskId]);
  }

  async editTask(task) {
    const q = this.pool
      ? "UPDATE tasks SET name = $1, importance = $2, urgency = $3, link = $4, due_date = $5, notes = $6, status = $7 WHERE id = $8"
      : "UPDATE tasks SET name = ?, importance = ?, urgency = ?, link = ?, due_date = ?, notes = ?, status = ? WHERE id = ?";
    await this.query(q, [task.name, task.importance, task.urgency, task.link, task.due_date, task.notes, task.status, task.id]);
  }

  async bulkImportTasks(tasks, userId) {
    const results = { imported: 0, updated: 0, errors: [] };
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.name) continue;

      const existing = await this.query(
        this.pool ? "SELECT id, user_id FROM tasks WHERE name = $1" : "SELECT id, user_id FROM tasks WHERE name = ?",
        [task.name]
      );

      if (existing.length > 0) {
        if (userId && existing[0].user_id === null) {
          await this.query(this.pool ? "UPDATE tasks SET user_id = $1 WHERE id = $2" : "UPDATE tasks SET user_id = ? WHERE id = ?", [userId, existing[0].id]);
          results.updated++;
        } else {
          results.updated++;
        }
        continue;
      }

      await this.addTask(task, userId);
      results.imported++;
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

  async setTaskParent(taskId, parentId) {
    const q = parentId === null 
      ? (this.pool ? "UPDATE tasks SET parent_id = NULL WHERE id = $1" : "UPDATE tasks SET parent_id = NULL WHERE id = ?")
      : (this.pool ? "UPDATE tasks SET parent_id = $1 WHERE id = $2" : "UPDATE tasks SET parent_id = ? WHERE id = ?");
    const params = parentId === null ? [taskId] : [parentId, taskId];
    await this.query(q, params);
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
export const deleteTask = (id) => database.deleteTask(id);
export const toggleTaskDone = (id) => database.toggleTaskDone(id);
export const updateSubtask = (s) => database.updateSubtask(s);
export const updateTaskNotes = (id, n) => database.updateTaskNotes(id, n);
export const editTask = (t) => database.editTask(t);
export const bulkImportTasks = (t, u) => database.bulkImportTasks(t, u);
export const startTimer = (id) => database.startTimer(id);
export const stopTimer = (id) => database.stopTimer(id);
export const setTaskParent = (id, p) => database.setTaskParent(id, p);
export const upsertUser = (u) => database.upsertUser(u);
export const initDatabase = () => database.init();
export default database;
