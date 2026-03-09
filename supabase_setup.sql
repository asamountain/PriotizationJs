-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create tasks table
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  importance INTEGER DEFAULT 5,
  urgency INTEGER DEFAULT 5,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link TEXT,
  due_date TEXT,
  notes TEXT,
  progress INTEGER,
  category TEXT,
  status TEXT,
  total_time_spent INTEGER DEFAULT 0,
  active_timer_start TIMESTAMPTZ,
  pomodoro_count INTEGER DEFAULT 0,
  last_worked_at TIMESTAMPTZ
);

-- Create time_logs table
CREATE TABLE time_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER DEFAULT 0,
  session_type TEXT DEFAULT 'focus',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Note: The 'session' table for connect-pg-simple will be created automatically 
-- because we set 'createTableIfMissing: true' in server.js.
