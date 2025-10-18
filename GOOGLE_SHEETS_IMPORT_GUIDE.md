# Google Sheets CSV Import Guide

## Quick Fix for "Missing task name" Error

The error you're seeing means the CSV parser can't find the task names. This is usually because:
1. Your Google Sheet columns have different names than expected
2. The CSV wasn't exported correctly

## ✅ Step-by-Step Solution

### Step 1: Set Up Your Google Sheet Columns

Your Google Sheet **MUST** have these column headers in the first row:

**Required (at minimum):**
- `name` (or `task`, `title`, `task name`)

**Optional columns:**
- `importance` (number 0-10, default: 5)
- `urgency` (number 0-10, default: 5)
- `done` (true/false, default: false)
- `link` (URL)
- `due_date` (date like 2025-12-31)
- `notes` (any text)
- `parent_id` (for subtasks, leave empty for main tasks)

### Example Google Sheet Setup:

```
| name                  | importance | urgency | done  | link                    | due_date   | notes          |
|-----------------------|------------|---------|-------|-------------------------|------------|----------------|
| Complete documentation| 8          | 7       | false | https://docs.example.com| 2025-12-31 | Finish API docs|
| Review pull requests  | 6          | 9       | false |                         |            | Check security |
| Update dependencies   | 5          | 4       | false |                         | 2025-12-01 |                |
```

### Step 2: Export from Google Sheets

1. Open your Google Sheet
2. Click **File** menu
3. Click **Download**
4. Select **Comma Separated Values (.csv)** ⚠️ **NOT** "Plain Text"
5. Save the file

### Step 3: Import to Your App

1. Open your Priority Task Manager (http://localhost:3000)
2. Find the "Import Tasks from CSV" section
3. Click "Select CSV file"
4. Choose your downloaded .csv file
5. Click "Import CSV"

## 🔍 Troubleshooting

### How to See What Went Wrong

When you try to import, check your **server terminal** (where you ran `node server.js`). You'll see:

```
CSV file first 200 chars: name,importance,urgency...
Parsed records count: 269
First record columns: [ 'name', 'importance', 'urgency', ... ]
First record sample: { name: 'Your Task', importance: '5', ... }
```

### Common Problems:

**Problem 1: Column names are wrong**
- ❌ BAD: `Task`, `Task Name`, `Description` (won't work)
- ✅ GOOD: `name` or `task` or `title` (case doesn't matter)

**Problem 2: No header row**
- Make sure Row 1 has column names, not data
- Data should start from Row 2

**Problem 3: Wrong file format**
- Must be `.csv` format
- NOT `.txt`, `.xlsx`, or `.xls`

**Problem 4: Empty columns**
- Empty rows are automatically skipped (that's OK)
- But every row with data MUST have a task name

## 📋 Minimal Working Example

The absolute simplest Google Sheet that works:

```
name
Buy groceries
Call dentist
Review budget
```

Just one column! Everything else is optional.

## 🎯 Full Example with All Columns

```
name,importance,urgency,done,link,due_date,notes
Complete project docs,8,7,false,https://docs.example.com,2025-12-31,Need to finish API section
Review code PRs,6,9,false,https://github.com/myrepo,2025-11-15,Focus on security
Update npm packages,5,4,false,,2025-12-01,Check vulnerabilities
Plan team meeting,7,8,false,,2025-10-25,Discuss Q4 roadmap
```

## 💡 Pro Tips

1. **Use the template**: Click "Download Template" button in your app to get a pre-formatted CSV
2. **Test with small file first**: Try importing 5-10 tasks before doing hundreds
3. **Check the terminal**: Always look at server logs to see what's being parsed
4. **Column names are flexible**: `name`, `task`, `title` all work (case doesn't matter)

## 🆘 Still Not Working?

If you still get "Missing task name" errors:

1. Copy your CSV content and paste it into a text editor
2. Check if the very first line has column headers
3. Make sure the first column is named `name` (or `task`, `title`)
4. Save as plain CSV (not CSV UTF-8 or other variants)
5. Check server terminal for what columns were detected

Need help? Check the server terminal output - it shows exactly what the parser is seeing!

