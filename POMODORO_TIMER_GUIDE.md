# Pomodoro Timer & Time Tracking System

**Date:** October 18, 2025  
**Version:** 1.0  
**Status:** ✅ Implemented

---

## 🎯 Overview

Each task now includes an integrated Pomodoro timer that tracks:
- ⏱️ **Active focus time** - Live timer while working
- 📊 **Total time spent** - Cumulative time across all sessions
- 🍅 **Pomodoro count** - Number of 25+ minute sessions completed
- 📝 **Session logs** - Detailed history of all work sessions

---

## 🎨 User Interface

### Timer Display (On Each Task)

```
┌─────────────────────────────────────────────────┐
│ ✅ Complete homework                            │
│    ⭐ Importance: 8/10  ⏰ Urgency: 9/10       │
│    [🕐 2:35] [▶️]  📝 ➕ ✏️ 🗑️              │
└─────────────────────────────────────────────────┘
```

**Timer Components:**
- **Time Chip**: Shows elapsed time (red when running, grey when stopped)
- **Play/Stop Button**: Toggle timer on/off
- **Format**: `M:SS` or `H:MM:SS` for longer sessions

**Visual States:**
- 🔴 **Red chip + timer icon** = Timer running
- ⚫ **Grey chip + outline icon** = Timer stopped (shows total time)

---

## 🚀 How to Use

### Starting a Timer
1. Click the **▶️ play button** next to any task
2. Timer starts tracking immediately
3. Chip turns **red** and shows live elapsed time
4. Continue working on your task!

### Automatic Pomodoro Completion (NEW! 🎉)
1. Timer **automatically stops** at 25 minutes
2. **Pleasant chime sound** plays (3-tone C-E-G chord)
3. **Break dialog appears** with options:
   - **Start Break** → Begins 5-min (or 15-min) break timer
   - **Skip Break** → Continue working immediately
4. Every **4th Pomodoro** → Long break (15 minutes)
5. Break timer shows in **top snackbar** with countdown

### Manual Stop
1. Click the **⏹️ stop button** anytime before 25 minutes
2. Session is logged automatically
3. Time is added to task's total time
4. If session ≥ 25 minutes → +1 pomodoro count

### Break Management
- **Short Break** (5 min) → After 1st, 2nd, 3rd Pomodoros
- **Long Break** (15 min) → After 4th Pomodoro
- Break timer counts down in real-time
- **Chime plays** when break ends
- Can **end break early** by clicking X

### Multiple Timers
- ✅ You can run multiple timers simultaneously
- ✅ Each task tracks independently
- ✅ All timers sync in real-time across devices
- ✅ Each timer triggers its own 25-min completion

---

## 💾 Database Schema

### Tasks Table (Extended)
```sql
ALTER TABLE tasks ADD COLUMN total_time_spent INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN active_timer_start TEXT NULL;
ALTER TABLE tasks ADD COLUMN pomodoro_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN last_worked_at TEXT NULL;
```

### Time Logs Table (New)
```sql
CREATE TABLE time_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NULL,
  duration INTEGER DEFAULT 0,
  session_type TEXT DEFAULT 'focus',
  notes TEXT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

**Fields Explained:**
- `total_time_spent`: Seconds spent on task (cumulative)
- `active_timer_start`: ISO timestamp when timer started (NULL = not running)
- `pomodoro_count`: Number of ≥25min sessions
- `last_worked_at`: Last time task was worked on
- `time_logs`: Individual session records for analytics

---

## 🔌 Socket.IO Events

### Client → Server
```javascript
socket.emit('startTimer', taskId);
socket.emit('stopTimer', taskId);
socket.emit('getTimeLogs', taskId);
```

### Server → Client
```javascript
socket.on('timerStarted', (result) => {
  // { taskId, startTime }
});

socket.on('timerStopped', (result) => {
  // { taskId, duration, totalTime, logId }
});

socket.on('timeLogs', ({ taskId, logs }) => {
  // Array of session logs for analytics
});

socket.on('timerError', ({ error }) => {
  // Error handling
});
```

---

## 📈 Analytics (Future Implementation)

### Planned Features

#### 1. **Personal Analytics Dashboard**
Route: `/analytics` or `/insights`

**Metrics to Display:**
- 📊 **Daily/Weekly/Monthly Focus Time**
  - Bar chart showing time spent per day
  - Trend line for focus consistency
  
- 🍅 **Pomodoro Statistics**
  - Total pomodoros completed
  - Average pomodoros per day
  - Best focus day/time patterns
  
- 🎯 **Task Completion Correlation**
  - Time spent vs. completion rate
  - Which tasks take longest
  - Estimate vs. actual time comparison

- ⏰ **Focus Quality Indicators**
  - Session length distribution
  - Interruption frequency (short sessions)
  - Deep work periods (2+ hour sessions)
  
- 📅 **Time Allocation by Category**
  - Pie chart: Personal vs. Work vs. Learning
  - Importance/Urgency quadrant time distribution
  
- 🔥 **Productivity Streaks**
  - Consecutive days with active focus
  - Best focus streak
  - Current streak status

#### 2. **Task-Level Analytics**
On task detail view:

- **Time Investment**: Total time vs. estimate
- **Session History**: Calendar heatmap of work sessions
- **Focus Pattern**: Best time of day for this task type
- **Completion Prediction**: Est. time to complete based on progress

#### 3. **Comparative Analytics**
- **Quadrant Analysis**: Which matrix quadrant gets most time?
- **Task Type Performance**: Speed by category/status
- **ROI Analysis**: Important tasks vs. time spent

#### 4. **Export & Reporting**
- CSV export of all time logs
- PDF reports (weekly/monthly summaries)
- Integration with calendar apps
- Time tracking API for external tools

---

## 🛠️ Technical Implementation Notes

### Timer Updates
- Frontend: 1-second interval updates `currentTime`
- Backend: Calculates duration on stop
- No server polling - efficient client-side display

### Automatic 25-Minute Detection
```javascript
checkPomodoroCompletion() {
  const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds
  
  this.tasks.forEach(task => {
    if (task.active_timer_start) {
      const elapsed = this.getElapsedTime(task.active_timer_start);
      const pomodoroKey = `${task.id}-${task.active_timer_start}`;
      
      // Check if this specific pomodoro session just completed
      if (elapsed >= POMODORO_DURATION && !this.completedPomodoros.has(pomodoroKey)) {
        this.completedPomodoros.add(pomodoroKey);
        this.onPomodoroComplete(task);
      }
    }
  });
}
```

**Key Features:**
- Runs every second via `setInterval`
- Tracks completed sessions with `Set` to prevent duplicates
- Unique key per session: `${taskId}-${startTime}`
- Triggers at exactly 25:00 (1500 seconds)

### Audio Notification (Web Audio API)
```javascript
playCompletionChime() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Pleasant 3-tone chime: C5 → E5 → G5
  playTone(523.25, now, 0.3);        // C5
  playTone(659.25, now + 0.15, 0.3); // E5
  playTone(783.99, now + 0.3, 0.5);  // G5
}
```

**Why Web Audio API?**
- ✅ No external audio files needed
- ✅ Consistent across all platforms
- ✅ Lightweight and instant
- ✅ Pleasant, non-intrusive sound

### Break Timer System
```javascript
// Data properties
showBreakDialog: false,
breakTask: null,
breakType: 'short', // 'short' (5min) or 'long' (15min)
breakTimeRemaining: 0,
breakInterval: null

// Automatically determines break type
this.breakType = (task.pomodoro_count % 4 === 0) ? 'long' : 'short';
```

**Break Logic:**
- Pomodoros 1-3 → 5-minute break
- Pomodoro 4 → 15-minute break
- Pomodoro 5 → Cycle restarts (5-min break)

### State Management
```javascript
// Vue reactive data
currentTime: Date.now()              // Updated every second
timerInterval: null                  // Interval handle
completedPomodoros: new Set()        // Track completed sessions
showBreakDialog: false               // Break modal state
breakTimeRemaining: 0                // Break countdown (seconds)

// Methods
getElapsedTime(startTime)            // Calculate seconds elapsed
formatTime(seconds)                  // Format as M:SS or H:MM:SS
toggleTimer(task)                    // Start/stop handler
checkPomodoroCompletion()            // Check for 25-min completion
onPomodoroComplete(task)             // Handle completion event
playCompletionChime()                // Play audio notification
startBreak()                         // Start break timer
endBreak()                           // End break (manual or auto)
skipBreak()                          // Dismiss break dialog
```

### Real-Time Sync
- Timer start/stop broadcasts to all connected clients
- Automatic UI update on socket events
- No page refresh needed
- Break dialog appears for the user who started the timer

### Data Integrity
- Transactions for consistent time logging
- Cascade delete: Logs removed with tasks
- Pomodoro auto-increment (≥25min sessions)
- Duplicate prevention with `Set` tracking

---

## 📊 Sample Analytics Queries

### Total Focus Time by Task
```sql
SELECT 
  t.name,
  t.total_time_spent / 3600.0 as hours_spent,
  t.pomodoro_count,
  COUNT(tl.id) as sessions
FROM tasks t
LEFT JOIN time_logs tl ON t.id = tl.task_id
GROUP BY t.id
ORDER BY t.total_time_spent DESC;
```

### Daily Focus Summary
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as sessions,
  SUM(duration) / 3600.0 as total_hours,
  AVG(duration) / 60.0 as avg_session_minutes
FROM time_logs
WHERE created_at >= datetime('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Focus Quality Score
```sql
SELECT 
  task_id,
  COUNT(*) as total_sessions,
  SUM(CASE WHEN duration >= 1500 THEN 1 ELSE 0 END) as quality_sessions,
  ROUND(100.0 * SUM(CASE WHEN duration >= 1500 THEN 1 ELSE 0 END) / COUNT(*), 2) as quality_score
FROM time_logs
GROUP BY task_id;
```

---

## 🎨 Future UI Enhancements

### V2 Features (Completed! ✅)
- ✅ **Auto-Stop at 25 Minutes**: Timer stops automatically
- ✅ **Audio Notifications**: Pleasant chime on completion
- ✅ **Break Management**: Automatic break prompts (5/15 min)
- ✅ **Break Timer**: Countdown timer for breaks

### V3 Features (Planned)
- ⏸️ **Pause/Resume**: Pause timer without ending session
- 🔔 **Custom Intervals**: Configurable Pomodoro lengths (20/25/30 min)
- 🎵 **Focus Music**: Play background sounds during work
- 📊 **Mini Dashboard**: Time stats in sidebar
- 🏆 **Achievements**: Badges for streaks/milestones
- 🌈 **Visual Timeline**: Daily focus heatmap
- 🌅 **Do Not Disturb**: Browser notifications disabled during focus

### V4 Features (Future)
- 🤖 **AI Insights**: Personalized productivity recommendations
- 📱 **Mobile App**: Cross-platform time tracking
- 👥 **Team Analytics**: Collaborative focus metrics
- 🔗 **Integration**: Todoist, Notion, Calendar sync
- 💬 **Focus Mode**: Hide distracting UI elements
- 📈 **Focus Prediction**: ML-based optimal work times

---

## 🐛 Known Limitations

1. **Browser Only**: Timer doesn't run when browser closed
2. **Client Time**: Uses client clock (may drift)
3. **No Pause**: Stop = end session (planned for V3)
4. **Single Notification**: Only the user who started timer sees break dialog
5. **No Persistence**: Break timer resets on page refresh

---

## 📝 Best Practices

### For Users
1. **Start timer when you begin working** - Not before
2. **Stop timer during breaks** - Keep data accurate
3. **Review logs weekly** - Identify patterns
4. **Set realistic goals** - 4-6 pomodoros/day is excellent

### For Developers
1. **Always use transactions** for time logging
2. **Validate timestamps** server-side
3. **Clean up stale timers** on disconnect
4. **Cache analytics queries** for performance

---

## 🚀 Roadmap

- [x] **Phase 1**: Basic timer functionality ✅
- [x] **Phase 2**: Time logging backend ✅
- [x] **Phase 3**: Real-time sync ✅
- [x] **Phase 4**: Auto-completion & breaks ✅ **← NEW!**
- [ ] **Phase 5**: Analytics dashboard (in progress)
- [ ] **Phase 6**: Advanced features (pause, custom intervals)
- [ ] **Phase 7**: Mobile app & integrations

---

**Questions or Feedback?**  
See [PRD.md](./PRD.md) for complete feature specification.

