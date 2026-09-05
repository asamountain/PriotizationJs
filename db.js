import pg from 'pg';

const isProduction = true; // Forcing PG as per user request

class Database {
  constructor() {
    this.pool = null; // PostgreSQL
  }

  async init() {
    console.log("Connecting to Cloud PostgreSQL...");
    const url = process.env.DATABASE_URL || '';
    const isLocal = /@(localhost|127\.0\.0\.1|::1)[:/]/.test(url) && !/sslmode=require/.test(url);
    this.pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
    await this.createTablesPostgres();
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
        importance REAL DEFAULT 5.0,
        urgency REAL DEFAULT 5.0,
        done BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        due_date TEXT,
        link TEXT,
        notes TEXT,
        progress REAL DEFAULT 0,
        category TEXT,
        status TEXT,
        total_time_spent INTEGER DEFAULT 0,
        active_timer_start TEXT,
        pomodoro_count INTEGER DEFAULT 0,
        last_worked_at TEXT,
        icon TEXT DEFAULT 'mdi-checkbox-blank-circle-outline'
      );

      CREATE TABLE IF NOT EXISTS task_relationships (
        id SERIAL PRIMARY KEY,
        enabler_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        enabled_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(enabler_task_id, enabled_task_id)
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

      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT,
        event TEXT NOT NULL,
        target TEXT,
        meta JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
      CREATE INDEX IF NOT EXISTS idx_task_relationships_user_id ON task_relationships(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
      CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
    `;
    await this.pool.query(query);
    
    // Migrations
    const migrations = [
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress REAL DEFAULT 0",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_time_spent INTEGER DEFAULT 0",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS active_timer_start TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pomodoro_count INTEGER DEFAULT 0",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_worked_at TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'mdi-checkbox-blank-circle-outline'",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'action'",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_focus BOOLEAN DEFAULT FALSE",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cost_of_inaction REAL",
      "UPDATE tasks SET cost_of_inaction = urgency WHERE cost_of_inaction IS NULL",
      "ALTER TABLE tasks ALTER COLUMN importance TYPE REAL",
      "ALTER TABLE tasks ALTER COLUMN urgency TYPE REAL",
      "ALTER TABLE tasks ALTER COLUMN progress TYPE REAL"
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

  async query(text, params) {
    const res = await this.pool.query(text, params);
    return res.rows;
  }

  async getTaskData(userId) {
    const query = userId 
      ? "SELECT * FROM tasks WHERE (user_id = $1 OR user_id IS NULL) ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, importance DESC, urgency DESC"
      : "SELECT * FROM tasks WHERE user_id IS NULL ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, parent_id, importance DESC, urgency DESC";
    return this.query(query, userId ? [userId] : []);
  }

  async addTask(task, userId) {
    const importance = Number(task.importance) || 5;
    const urgency = Number(task.urgency) || 5;
    const totalTime = Math.round(Number(task.total_time_spent) || 0);
    const pomodoros = Math.round(Number(task.pomodoro_count) || 0);
    const progress = Number(task.progress) || 0;

    const res = await this.pool.query(
      `INSERT INTO tasks (
        name, importance, urgency, user_id, done, link, due_date,
        notes, parent_id, total_time_spent, pomodoro_count, category, status,
        created_at, completed_at, icon, progress, kind, cost_of_inaction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        COALESCE($14, CURRENT_TIMESTAMP), $15, $16, $17, $18, $19) RETURNING id`,
      [
        task.name, importance, urgency, userId || null, !!task.done,
        task.link || null, task.due_date || null, task.notes || null,
        task.parent_id || null, totalTime, pomodoros,
        task.category || null, task.status || null,
        task.created_at || null, task.completed_at || null,
        task.icon || 'mdi-checkbox-blank-circle-outline',
        progress,
        task.kind || 'action',
        task.cost_of_inaction ?? null
      ]
    );
    return res.rows[0].id;
  }

  async modifyTask(task) {
    const importance = Number(task.importance) || 5;
    const urgency = Number(task.urgency) || 5;
    const progress = Number(task.progress) || 0;
    const q = "UPDATE tasks SET name = $1, importance = $2, urgency = $3, icon = $4, progress = $5 WHERE id = $6";
    await this.query(q, [task.name, importance, urgency, task.icon || 'mdi-checkbox-blank-circle-outline', progress, task.id]);
  }

  async deleteTask(id) {
    const q = "DELETE FROM tasks WHERE id = $1";
    await this.query(q, [id]);
  }

  async toggleTaskDone(id) {
    const tasks = await this.query("SELECT * FROM tasks WHERE id = $1", [id]);
    const task = tasks[0];
    if (!task) return;

    const now = new Date().toISOString();
    const updateQ = task.done 
      ? "UPDATE tasks SET done = FALSE, completed_at = NULL WHERE id = $1"
      : "UPDATE tasks SET done = TRUE, completed_at = $1 WHERE id = $2";
    
    const params = task.done ? [id] : [now, id];
    await this.query(updateQ, params);
    return task;
  }

  async addSubtask(subtask, parentId, userId) {
    return this.addTask({ ...subtask, parent_id: parentId }, userId);
  }

  async updateSubtask(subtask) {
    const importance = Number(subtask.importance) || 5;
    const urgency = Number(subtask.urgency) || 5;
    const progress = Number(subtask.progress) || 0;
    const q = "UPDATE tasks SET name = $1, importance = $2, urgency = $3, parent_id = $4, link = $5, due_date = $6, icon = $7, notes = $8, status = $9, progress = $10, cost_of_inaction = COALESCE($11, cost_of_inaction) WHERE id = $12";
    await this.query(q, [subtask.name, importance, urgency, subtask.parent_id, subtask.link, subtask.due_date, subtask.icon || 'mdi-checkbox-blank-circle-outline', subtask.notes, subtask.status, progress, subtask.cost_of_inaction ?? null, subtask.id]);
  }

  async updateTaskNotes(taskId, notes) {
    const q = "UPDATE tasks SET notes = $1 WHERE id = $2";
    await this.query(q, [notes, taskId]);
  }

  async editTask(task) {
    const importance = Number(task.importance) || 5;
    const urgency = Number(task.urgency) || 5;
    const progress = Number(task.progress) || 0;
    const q = "UPDATE tasks SET name = $1, importance = $2, urgency = $3, link = $4, due_date = $5, notes = $6, status = $7, icon = $8, progress = $9, category = $10, kind = COALESCE($11, kind), cost_of_inaction = COALESCE($12, cost_of_inaction) WHERE id = $13";
    await this.query(q, [task.name, importance, urgency, task.link, task.due_date, task.notes, task.status, task.icon || 'mdi-checkbox-blank-circle-outline', progress, task.category || null, task.kind ?? null, task.cost_of_inaction ?? null, task.id]);
  }

  async bulkImportTasks(tasks, userId) {
    const results = { imported: 0, updated: 0, errors: [] };
    const idMap = new Map();
    const subtasksToUpdate = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.name) continue;

      try {
        const existing = await this.query("SELECT id, user_id FROM tasks WHERE name = $1 AND (user_id = $2 OR user_id IS NULL)", [task.name, userId]);

        let finalId;
        if (existing.length > 0) {
          finalId = existing[0].id;
          if (userId && existing[0].user_id === null) {
            await this.query("UPDATE tasks SET user_id = $1 WHERE id = $2", [userId, finalId]);
          }
          results.updated++;
        } else {
          const taskData = { ...task, parent_id: null, icon: task.icon || 'mdi-checkbox-blank-circle-outline', progress: task.progress || 0 };
          finalId = await this.addTask(taskData, userId);
          results.imported++;
        }

        if (task.id) idMap.set(String(task.id), finalId);
        if (task.parent_id) subtasksToUpdate.push({ taskId: finalId, originalParentId: String(task.parent_id) });
      } catch (err) {
        results.errors.push({ row: i + 1, task: task.name, error: err.message });
      }
    }

    if (subtasksToUpdate.length > 0) {
      for (const link of subtasksToUpdate) {
        const newParentId = idMap.get(link.originalParentId);
        if (newParentId) await this.setTaskParent(link.taskId, newParentId);
      }
    }
    return results;
  }

  async startTimer(taskId) {
    const now = new Date().toISOString();
    const q = "UPDATE tasks SET active_timer_start = $1, last_worked_at = $2 WHERE id = $3";
    await this.query(q, [now, now, taskId]);
    return { taskId, startTime: now };
  }

  async stopTimer(taskId) {
    const tasks = await this.query("SELECT active_timer_start, total_time_spent FROM tasks WHERE id = $1", [taskId]);
    const task = tasks[0];
    if (!task || !task.active_timer_start) return { taskId, duration: 0, alreadyStopped: true };

    const duration = Math.floor((new Date() - new Date(task.active_timer_start)) / 1000);
    const newTotalTime = (task.total_time_spent || 0) + duration;
    const pomodoroIncr = duration >= 1500 ? 1 : 0;

    await this.query("UPDATE tasks SET active_timer_start = NULL, total_time_spent = $1, pomodoro_count = pomodoro_count + $2 WHERE id = $3", [newTotalTime, pomodoroIncr, taskId]);
    await this.query("INSERT INTO time_logs (task_id, start_time, end_time, duration) VALUES ($1, $2, $3, $4)", [taskId, task.active_timer_start, new Date().toISOString(), duration]);

    return { taskId, duration, totalTime: newTotalTime };
  }

  async getTimeLogs(taskId) {
    return this.query("SELECT * FROM time_logs WHERE task_id = $1 ORDER BY created_at DESC", [taskId]);
  }

  async getActiveTimers() {
    return this.query("SELECT id, name, active_timer_start FROM tasks WHERE active_timer_start IS NOT NULL", []);
  }

  async setTaskParent(taskId, parentId) {
    const q = parentId === null ? "UPDATE tasks SET parent_id = NULL WHERE id = $1" : "UPDATE tasks SET parent_id = $1 WHERE id = $2";
    await this.query(q, parentId === null ? [taskId] : [parentId, taskId]);
  }

  async updateTaskStatus(taskId, status) {
    await this.query("UPDATE tasks SET status = $1 WHERE id = $2", [status, taskId]);
  }

  async updateTaskIcon(taskId, icon) {
    await this.query("UPDATE tasks SET icon = $1 WHERE id = $2", [icon, taskId]);
  }

  async setTaskFocus(taskId, isFocus) {
    await this.query("UPDATE tasks SET is_focus = $1 WHERE id = $2", [!!isFocus, taskId]);
  }

  async upsertUser(user) {
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO users (id, email, name, avatar, provider, last_login)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET
       email = EXCLUDED.email, name = EXCLUDED.name, avatar = EXCLUDED.avatar, last_login = EXCLUDED.last_login`,
      [user.id, user.email, user.name, user.avatar, user.provider || 'google', now]
    );
    return user;
  }

  async addTaskRelationship(enablerId, enabledId, userId) {
    await this.query("INSERT INTO task_relationships (enabler_task_id, enabled_task_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (enabler_task_id, enabled_task_id) DO NOTHING", [enablerId, enabledId, userId]);
  }

  // The app started single-user, so its existing tasks have user_id IS NULL.
  // Hand that legacy data to whoever is the very first person to sign in
  // (the original owner), so a stranger who registers second gets a blank
  // slate instead of inheriting it via the "OR user_id IS NULL" fallback.
  async claimLegacyDataIfFirstUser(userId) {
    const [{ count }] = await this.query("SELECT COUNT(*)::int AS count FROM users");
    if (count > 1) return;
    await this.query("UPDATE tasks SET user_id = $1 WHERE user_id IS NULL", [userId]);
    await this.query("UPDATE task_relationships SET user_id = $1 WHERE user_id IS NULL", [userId]);
  }

  async removeTaskRelationship(enablerId, enabledId) {
    await this.query("DELETE FROM task_relationships WHERE enabler_task_id = $1 AND enabled_task_id = $2", [enablerId, enabledId]);
  }

  async getTasksEnabledBy(taskId) {
    return this.query("SELECT t.* FROM tasks t INNER JOIN task_relationships tr ON t.id = tr.enabled_task_id WHERE tr.enabler_task_id = $1", [taskId]);
  }

  async getTasksThatEnable(taskId) {
    return this.query("SELECT t.* FROM tasks t INNER JOIN task_relationships tr ON t.id = tr.enabler_task_id WHERE tr.enabled_task_id = $1", [taskId]);
  }

  async getTaskRelationships(taskId) {
    const enables = await this.getTasksEnabledBy(taskId);
    const enabledBy = await this.getTasksThatEnable(taskId);
    return { enables, enabledBy };
  }

  async getAllTaskRelationships(userId) {
    return this.query("SELECT enabler_task_id, enabled_task_id FROM task_relationships WHERE user_id = $1 OR user_id IS NULL", [userId]);
  }

  calculateLeverageScoresFromGraph(relationships, tasks) {
    const graph = new Map();
    for (const rel of relationships) {
      if (!graph.has(rel.enabler_task_id)) graph.set(rel.enabler_task_id, []);
      graph.get(rel.enabler_task_id).push(rel.enabled_task_id);
    }

    const memo = new Map();
    const getReachability = (taskId) => {
      if (memo.has(taskId)) return memo.get(taskId);
      const reachable = new Set();
      const enabled = graph.get(taskId) || [];
      let totalInfluence = 0;
      for (const enabledId of enabled) {
        const enabledTask = tasks.find(t => t.id === enabledId);
        const weight = enabledTask ? (enabledTask.importance / 5) : 1;
        if (!reachable.has(enabledId)) {
          reachable.add(enabledId);
          totalInfluence += weight;
          const childReachable = getReachability(enabledId);
          totalInfluence += (childReachable.size * 0.5);
        }
      }
      memo.set(taskId, { size: totalInfluence });
      return { size: totalInfluence };
    };

    const leverageScores = {};
    for (const [taskId] of graph) leverageScores[taskId] = getReachability(taskId).size;
    return leverageScores;
  }

  async calculateLeverageScore(taskId) {
    const [relationships, tasks] = await Promise.all([this.getAllTaskRelationships(null), this.getTaskData(null)]);
    const scores = this.calculateLeverageScoresFromGraph(relationships, tasks);
    return scores[taskId] || 0;
  }

  async getTaskDataWithLeverage(userId) {
    const [tasks, relationships] = await Promise.all([this.getTaskData(userId), this.getAllTaskRelationships(userId)]);
    const leverageScores = this.calculateLeverageScoresFromGraph(relationships, tasks);
    return tasks.map(task => ({ ...task, leverage_score: leverageScores[task.id] || 0 }));
  }

  async logEvents(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    const capped = rows.slice(0, 200);
    const values = [];
    const params = [];
    capped.forEach((r, i) => {
      const b = i * 4;
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`);
      params.push(
        String(r.session_id || '').slice(0, 64) || null,
        String(r.event || '').slice(0, 64),
        r.target == null ? null : String(r.target).slice(0, 128),
        r.meta == null ? null : JSON.stringify(r.meta).slice(0, 2000)
      );
    });
    await this.query(
      `INSERT INTO events (session_id, event, target, meta) VALUES ${values.join(', ')}`,
      params
    );
    return capped.length;
  }

  async getEventSummary(days = 7) {
    const d = Math.max(1, Math.min(365, Number(days) || 7));
    const since = `NOW() - INTERVAL '${d} days'`;
    const [byEvent, byTarget, byDay, sessions] = await Promise.all([
      this.query(`SELECT event, COUNT(*)::int AS n FROM events WHERE ts >= ${since} GROUP BY event ORDER BY n DESC`),
      this.query(`SELECT event, target, COUNT(*)::int AS n FROM events WHERE ts >= ${since} AND target IS NOT NULL GROUP BY event, target ORDER BY n DESC LIMIT 40`),
      this.query(`SELECT to_char(ts::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n FROM events WHERE ts >= ${since} GROUP BY day ORDER BY day`),
      this.query(`SELECT COUNT(DISTINCT session_id)::int AS n FROM events WHERE ts >= ${since}`)
    ]);
    return { days: d, byEvent, byTarget, byDay, sessions: sessions[0] ? sessions[0].n : 0 };
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
export const updateTaskIcon = (id, i) => database.updateTaskIcon(id, i);
export const setTaskFocus = (id, isFocus) => database.setTaskFocus(id, isFocus);
export const upsertUser = (u) => database.upsertUser(u);
export const claimLegacyDataIfFirstUser = (userId) => database.claimLegacyDataIfFirstUser(userId);
export const addTaskRelationship = (e, d, u) => database.addTaskRelationship(e, d, u);
export const removeTaskRelationship = (e, d) => database.removeTaskRelationship(e, d);
export const getTasksEnabledBy = (id) => database.getTasksEnabledBy(id);
export const getTasksThatEnable = (id) => database.getTasksThatEnable(id);
export const getTaskRelationships = (id) => database.getTaskRelationships(id);
export const calculateLeverageScore = (id) => database.calculateLeverageScore(id);
export const getTaskDataWithLeverage = (u) => database.getTaskDataWithLeverage(u);
export const logEvents = (rows) => database.logEvents(rows);
export const getEventSummary = (days) => database.getEventSummary(days);
export const initDatabase = () => database.init();
export default database;
