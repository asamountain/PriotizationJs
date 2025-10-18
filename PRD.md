# Product Requirements Document (PRD)
# Priority Task Manager

**Version:** 1.0  
**Last Updated:** October 18, 2025  
**Status:** Active Development

---

## 1. PROJECT OVERVIEW

### 1.1 Purpose
A web-based task prioritization system that helps users manage tasks based on importance and urgency using the Eisenhower Matrix visualization.

### 1.2 Core Value Proposition
- Visual prioritization using D3.js scatter plot (Importance vs Urgency)
- Hierarchical task structure (tasks with subtasks)
- Real-time synchronization across clients using Socket.IO
- CSV import/export for bulk task management from Google Sheets

### 1.3 Technology Stack
**ESTABLISHED - DO NOT CHANGE WITHOUT EXPLICIT APPROVAL:**
- **Backend:** Node.js with Express
- **Frontend:** Vue 3 + Vuetify 3 (Material Design)
- **Database:** SQLite3 (file-based: `tasks.db`)
- **Real-time:** Socket.IO
- **Visualization:** D3.js v7
- **File Upload:** Multer
- **CSV Parsing:** csv-parse
- **Module System:** ES Modules (type: "module")

### 1.4 File Structure
```
PriotizationNodeJs/
├── server.js           # Express server & API endpoints
├── db.js              # Database layer (SQLite)
├── socket.js          # Socket.IO event handlers
├── package.json       # Dependencies
├── start-app.command  # Launch script (no sudo required)
├── uploads/           # Temporary CSV upload directory
├── tasks.db           # SQLite database file
├── sample-tasks-template.csv
└── public/
    ├── index.html     # Main Vue app template
    ├── app.js         # Vue app initialization
    ├── taskManager.js
    ├── modules/
    │   ├── chartVisualization.js
    │   ├── taskOperations.js
    │   ├── taskListManager.js
    │   └── ...
    └── services/
        ├── chartService.js
        ├── notificationService.js
        ├── socketService.js
        └── taskApi.js
```

---

## 2. DATABASE SCHEMA

### 2.1 Tasks Table
**ESTABLISHED SCHEMA - DO NOT MODIFY WITHOUT MIGRATION:**

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  importance INTEGER DEFAULT 5,        -- Range: 0-10
  urgency INTEGER DEFAULT 5,           -- Range: 0-10
  done BOOLEAN DEFAULT 0,              -- 0=false, 1=true
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT NULL,
  parent_id INTEGER NULL,              -- Foreign key to tasks.id
  link TEXT NULL,                      -- URL link
  due_date TEXT NULL,                  -- ISO date string
  notes TEXT NULL,                     -- Long-form notes
  FOREIGN KEY (parent_id) REFERENCES tasks(id)
)
```

### 2.2 Data Relationships
- **Parent Tasks:** `parent_id = NULL`
- **Subtasks:** `parent_id = <parent_task_id>`
- Tasks can have multiple subtasks but only one parent

---

## 3. CORE FEATURES

### 3.1 Task Management (ESTABLISHED)
✅ **Create Task**
- Input: name, importance (0-10), urgency (0-10)
- Optional: link, due_date, notes
- Auto-generated: id, created_at

✅ **Edit Task**
- Modify: name, importance, urgency, link, due_date, notes
- Cannot modify: id, created_at, parent_id

✅ **Delete Task**
- Hard delete from database
- Cascade behavior: subtasks remain orphaned (keep as-is)

✅ **Toggle Task Completion**
- Updates: done (true/false), completed_at (timestamp)
- Affects chart display (completed tasks excluded from chart)

### 3.2 Subtask Management (ESTABLISHED)
✅ **Add Subtask**
- Attached to parent task via parent_id
- Has same properties as parent tasks
- Displayed in expandable list under parent

✅ **Edit Subtask**
- Can modify all properties including parent_id (convert to main task)

✅ **Subtask Visibility Toggle**
- Show/hide completed subtasks with eye icon button

### 3.3 Notes System (ESTABLISHED)
✅ **Task Notes**
- Modal dialog for editing long-form notes
- Shows preview in task list (first 50 characters)
- Icon indicator when notes exist
- Accessible via pencil/note icon button

### 3.4 Visualization (ESTABLISHED)
✅ **D3.js Scatter Plot**
- X-axis: Urgency (0-10)
- Y-axis: Importance (0-10)
- Each task = colored dot
- Quadrants represent Eisenhower Matrix:
  - Q1 (top-right): Do First (high importance, high urgency)
  - Q2 (top-left): Schedule (high importance, low urgency)
  - Q3 (bottom-right): Delegate (low importance, high urgency)
  - Q4 (bottom-left): Eliminate (low importance, low urgency)

✅ **Interactive Features**
- Hover: Show tooltip with task name
- Click: Highlight task in list below
- Scroll to highlighted task automatically
- Clustered dots when tasks overlap

### 3.5 CSV Import/Export (NEW - ESTABLISHED)
✅ **Import CSV**
- Endpoint: `POST /api/import-csv`
- Accepts: `.csv` file via multipart/form-data
- Required column: `name`
- Optional columns: `importance`, `urgency`, `done`, `link`, `due_date`, `notes`, `parent_id`
- Defaults: importance=5, urgency=5, done=false
- Transaction-based bulk insert
- Returns: import results with error details

✅ **Download Template**
- Endpoint: `GET /api/csv-template`
- Returns: CSV template with headers and sample rows
- Format: RFC 4180 compliant CSV

✅ **CSV Format Specification**
```csv
name,importance,urgency,done,link,due_date,notes,parent_id
Task Name,8,7,false,https://example.com,2025-12-31,Sample notes,
```

✅ **CSV Column Flexibility**
The parser supports multiple column name variations (case-insensitive):
- Task name: `name`, `task`, `task name`, `title`
- Link: `link`, `url`
- Due date: `due_date`, `duedate`, `due date`
- Notes: `notes`, `note`, `description`
- Parent ID: `parent_id`, `parentid`, `parent id`

✅ **Google Sheets Export Handling**
- Automatically strips UTF-8 BOM (Byte Order Mark)
- Handles quoted and unquoted fields
- Case-insensitive column matching
- Flexible column count per row

### 3.6 Real-time Synchronization (ESTABLISHED)
✅ **Socket.IO Events**
- `connect` → Request initial data
- `initialData` → Receive task list on connect
- `updateTasks` → Broadcast changes to all clients
- `csvImported` → Notify clients after CSV import
- `addTask`, `modifyTask`, `deleteTask`, `toggleDone`
- `addSubtask`, `updateSubtask`, `editTask`
- `updateTaskNotes`, `getTaskDetails`

### 3.7 UI/UX Features (ESTABLISHED)
✅ **Theme Toggle**
- Light/Dark mode
- Persists to localStorage
- Material Design color palettes

✅ **Notifications**
- Snackbar notifications for user actions
- Success/error/info states
- Auto-dismiss after 3 seconds

✅ **Responsive Design**
- Desktop and mobile layouts
- Vuetify grid system
- Touch-friendly controls

---

## 4. API ENDPOINTS

### 4.1 Web Pages
```
GET /                    → Serve index.html
```

### 4.2 RESTful API
```
POST /api/import-csv     → Upload and import CSV file
                           Body: multipart/form-data with 'csvFile'
                           Returns: { success, message, details }

GET /api/csv-template    → Download CSV template
                           Returns: text/csv file
```

### 4.3 Socket.IO Events (Real-time)
All task operations handled via Socket.IO (see section 3.6)

---

## 5. USER WORKFLOWS

### 5.1 Standard Task Creation
1. User enters task name, adjusts importance/urgency sliders
2. Optionally adds link, notes
3. Clicks "Add Task"
4. Task appears in list and chart
5. Socket.IO broadcasts to all connected clients

### 5.2 CSV Import Workflow
1. User exports tasks from Google Sheets as CSV
2. User clicks "Select CSV file" in import section
3. User chooses CSV file from file system
4. User clicks "Import CSV" button
5. Backend validates and imports tasks
6. Success message shows count of imported tasks
7. Error messages show which rows failed (if any)
8. Tasks automatically appear in list and chart
9. All connected clients receive update

### 5.3 Task Prioritization Workflow
1. User views scatter plot to identify task quadrants
2. User clicks dots in chart to locate tasks in list
3. User adjusts importance/urgency via edit dialog
4. Chart updates in real-time
5. User completes tasks by checking checkbox
6. Completed tasks move to "Completed Tasks" section

---

## 6. TECHNICAL CONSTRAINTS

### 6.1 MUST NOT CHANGE
- ❌ Do not switch databases (SQLite only)
- ❌ Do not change to TypeScript
- ❌ Do not add authentication/users (single-user app)
- ❌ Do not require sudo for execution
- ❌ Keep single terminal workflow
- ❌ Maintain ES modules (not CommonJS)
- ❌ Keep Vuetify 3 (Material Design)

### 6.2 Performance Requirements
- CSV import: Handle up to 1000 tasks
- Chart rendering: Smooth with 500+ tasks
- Socket latency: < 100ms for local operations

### 6.3 Browser Support
- Chrome/Edge (Chromium) - Primary
- Firefox - Secondary
- Safari - Secondary
- Mobile browsers (iOS Safari, Chrome Android)

---

## 7. DEPLOYMENT

### 7.1 How to Start
```bash
# Standard method (no sudo)
node server.js

# OR use the launch script
./start-app.command
```

### 7.2 Port Configuration
- Default: `3000`
- Auto-fallback: If 3000 is taken, tries 3001, 3002, etc.
- Browser auto-opens on macOS via `open` command

### 7.3 Data Persistence
- Database: `tasks.db` (SQLite file in project root)
- Uploads: `uploads/` (temporary, files deleted after processing)
- No external database server required

---

## 8. FUTURE ENHANCEMENTS (NOT IMPLEMENTED)

### 8.1 Potential Features
- Export tasks to CSV
- Task filtering and search
- Due date reminders
- Task categories/tags
- Drag-and-drop in chart
- Task history/audit log
- Bulk edit operations
- Task templates

### 8.2 Out of Scope
- Multi-user support / Authentication
- Cloud sync / Remote database
- Mobile native apps
- Email notifications
- Calendar integration
- File attachments

---

## 9. MAINTENANCE GUIDELINES

### 9.1 Code Modification Rules
1. **Always** test CSV import after database changes
2. **Always** update socket events when adding features
3. **Always** maintain backward compatibility with existing `tasks.db`
4. **Never** break the single-file database model
5. **Document** all API changes in this PRD

### 9.2 Debugging
- Server logs: Console output (stdout)
- Database: Query `tasks.db` with SQLite CLI
- Client errors: Browser console
- Socket events: Logged to browser console with `SOCKET:` prefix

### 9.3 CSV Import Troubleshooting

**Problem: "Missing task name" errors**
- **Cause:** Column names not matching expected format
- **Solution:** Check server console for "First record columns" log
- **Debug:** Server logs show first 200 chars of CSV and parsed columns
- **Fix:** Ensure first row has headers, use supported column names

**Supported Column Name Formats (case-insensitive):**

| Required | Alternatives |
|----------|-------------|
| name | task, task name, title |
| importance | importance |
| urgency | urgency |
| done | done |
| link | url |
| due_date | duedate, due date |
| notes | note, description |
| parent_id | parentid, parent id |

**How to Check CSV File:**
1. Check server terminal output after upload attempt
2. Look for "CSV file first 200 chars:" - verify headers are present
3. Look for "First record columns:" - see what parser detected
4. Verify first row of CSV has column headers (not data)

**Common Google Sheets Export Issues:**
- Make sure to select "File → Download → Comma Separated Values (.csv)"
- Don't use "File → Download → Plain Text (.txt)"
- First row MUST be column headers
- At minimum, must have a "name" column

### 9.4 Dependency Updates
Current stable versions (DO NOT update without testing):
```json
{
  "express": "^4.21.1",
  "socket.io": "^4.8.1",
  "sqlite3": "^5.1.7",
  "vue": "^3.3.4",
  "vuetify": "^3.3.15",
  "d3": "^7.9.0",
  "multer": "^1.4.5-lts.1",
  "csv-parse": "^5.5.6"
}
```

---

## 10. SUCCESS METRICS

### 10.1 Core Functionality
- ✅ Users can create/edit/delete tasks
- ✅ Users can visualize task priorities
- ✅ Users can import tasks from Google Sheets
- ✅ Multiple users can work simultaneously (via Socket.IO)
- ✅ Data persists across sessions

### 10.2 User Experience
- ✅ Intuitive task prioritization
- ✅ Minimal friction for bulk imports
- ✅ Real-time updates without refresh
- ✅ Responsive on desktop and mobile

---

## 11. CONTACT & GOVERNANCE

### 11.1 Change Request Process
All changes must:
1. Reference this PRD
2. Update this document if specifications change
3. Maintain backward compatibility with existing data
4. Test CSV import functionality

### 11.2 This Document
- **Authority:** This PRD is the single source of truth
- **Updates:** Version number must increment on changes
- **AI Instructions:** AI assistants MUST read this PRD before making changes

---

**END OF DOCUMENT**

