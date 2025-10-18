# Resizable Layout & Quick Delete Guide 🎛️

## 🎯 New Features

### 1. Draggable Resize Handle

**What it is:**
A vertical divider between the chart (left) and task list (right) that you can drag to resize both panels.

**How to use:**
1. **Locate the handle** - Look for the thin vertical bar between the two panels
2. **Hover over it** - It will highlight in blue
3. **Click and drag** left or right
4. **Release** to set the new size
5. **Your preference is saved** automatically!

**Visual indicator:**
```
┌──────────┃───────────┐
│  Chart   ┃ Task List │
│          ┃           │
│  Hover   ┃  Scroll   │
│  me! →   ┃           │
└──────────┃───────────┘
           ↑
      Resize Handle
```

**Constraints:**
- **Minimum chart width:** 30%
- **Maximum chart width:** 70%
- Prevents panels from becoming too narrow

**Features:**
- ✅ Smooth drag experience
- ✅ Chart redraws automatically after resize
- ✅ Preference saved to localStorage
- ✅ Persists across browser sessions
- ✅ Visual feedback (blue highlight on hover)

---

### 2. One-Click Delete 🗑️

**What changed:**
Delete buttons now work with **one click** - no confirmation dialog!

**Before:**
```
Click trash → Confirm dialog → Click OK → Task deleted
```

**Now:**
```
Click trash → Task deleted → Notification shown ✅
```

**Features:**
- ✅ **Instant deletion** - no interruption
- ✅ **Visual notification** - see what was deleted
- ✅ **Safe** - tasks are in database, can be re-imported from CSV
- ✅ **Faster workflow** - especially when cleaning up many tasks

**Where to find:**
Every task has a trash bin icon (🗑️) on the right side:
- Active tasks: Red trash icon
- Completed tasks: Red trash icon
- Subtasks: Smaller trash icon

**Notification:**
After deletion, you'll see:
```
ℹ️  Deleted: [Task Name]
```

---

## 🎨 Visual Guide: Resize Handle

### Normal State:
```
Chart  │  Tasks
       │
```

### Hover State:
```
Chart  ┃  Tasks
       ┃  (blue highlight)
```

### Dragging:
```
Chart  ▌  Tasks
     ← Drag →
```

### Result:
```
Chart    │ Tasks    or    Chart│  Tasks
(60%)    │ (40%)          (40%)│  (60%)
```

---

## 💡 Usage Tips

### Resizing:
1. **More chart space?** Drag right to expand chart
2. **More task details?** Drag left to expand task list
3. **Default layout?** Set to 55/45 - works for most cases
4. **Experiment!** Find what works best for your workflow

### Deleting Tasks:
1. **Clean up quickly** - one-click delete for finished tasks
2. **No worries** - your CSV is the source of truth
3. **Re-import anytime** - just upload your CSV again
4. **Check notifications** - see what you deleted

---

## 🎯 Recommended Layouts

### For Chart Focus (Analysis Mode):
- **Chart:** 65-70%
- **Tasks:** 30-35%
- Use when prioritizing or reviewing task distribution

### For Balanced View (Default):
- **Chart:** 55%
- **Tasks:** 45%
- Best for simultaneous viewing and editing

### For Task Management (Detailed Mode):
- **Chart:** 30-35%
- **Tasks:** 65-70%
- Use when adding many tasks or editing details

---

## 🔧 Technical Details

### Resize Handle
- **Width:** 6px
- **Drag trigger:** mousedown event
- **Update frequency:** Real-time (every mouse move)
- **Storage:** localStorage key `leftPanelWidth`
- **Default value:** 55%

### One-Click Delete
- **No confirmation:** Immediate deletion
- **Notification duration:** 3 seconds (snackbar)
- **Database operation:** Permanent delete
- **Recovery:** Re-import from CSV source

---

## 🎓 Pro Tips

1. **Find your sweet spot** - Try different ratios for different tasks
2. **Chart-heavy for planning** - Use 70/30 when setting priorities
3. **Task-heavy for execution** - Use 30/70 when working through tasks
4. **Quick cleanup** - Delete tasks rapidly without confirmation delays
5. **Reset anytime** - Clear localStorage to reset to defaults

---

## 🐛 Troubleshooting

**Q: Resize handle not responding?**
A: Refresh the page. The handle should appear between the panels.

**Q: Can't drag beyond certain widths?**
A: By design! Constrained to 30-70% to keep both panels usable.

**Q: Chart looks weird after resize?**
A: It auto-redraws. If issue persists, refresh the page.

**Q: Accidentally deleted a task?**
A: Re-import your CSV file to restore all tasks from source.

**Q: Want the old confirmation dialog back?**
A: Not available - one-click delete is the new standard for faster workflow.

---

**Enjoy your customizable workspace!** 🎨

