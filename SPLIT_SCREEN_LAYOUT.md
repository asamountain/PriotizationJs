# Split-Screen Layout Guide 📐

## Overview

The app now features a **permanent split-screen layout** for maximum productivity!

```
┌─────────────────────────────────────────────────────────────┐
│  Priority Task Manager                              🌙       │  ← Header
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   LEFT SIDE (55%)        │   RIGHT SIDE (45%)              │
│   ═══════════════        │   ═══════════════               │
│                          │                                  │
│   📊 Eisenhower Matrix   │   📋 Task Lists                 │
│   ─────────────────────  │   ──────────────────            │
│                          │                                  │
│   Always full height     │   ⬇️ Scrollable:                │
│   Interactive chart      │   • CSV Import                  │
│   Click dots to          │   • Add Task Form               │
│   highlight tasks →      │   • Active Tasks (sorted)       │
│                          │   • Completed Tasks             │
│   [Chart fills screen]   │                                  │
│                          │   Edit, delete, manage          │
│                          │   tasks here                     │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

## 🎯 Key Features

### Left Side: Chart Panel (55% width)
- **Always visible** - never hidden
- **Full height** - uses entire viewport height
- **Interactive** - click dots to select tasks
- **Real-time updates** - changes reflect immediately
- Shows all active tasks in Eisenhower Matrix quadrants

### Right Side: Task Management (45% width)
- **Scrollable** - contains all your controls
- **CSV Import section** - bulk import tasks
- **Add Task form** - create new tasks quickly
- **Active Tasks list** - with sorting dropdown
- **Completed Tasks** - collapsible section

## 🔄 Interaction Flow

### Chart → List
1. Click any dot in the chart (left)
2. Task **highlights** in the list (right)
3. List **auto-scrolls** to show the selected task
4. See full task details immediately

### List → Chart
1. Edit a task in the list (right)
2. Change importance or urgency
3. Chart **updates instantly** (left)
4. Dot moves to new quadrant
5. Visual feedback of priority changes

## 📱 Responsive Design

### Desktop (> 1024px)
```
┌─────────────┬──────────────┐
│             │              │
│   Chart     │   Task List  │
│   (55%)     │   (45%)      │
│             │              │
└─────────────┴──────────────┘
```

### Tablet/Mobile (≤ 1024px)
```
┌───────────────────────────┐
│         Chart             │
│        (50vh)             │
├───────────────────────────┤
│       Task List           │
│      (remaining)          │
│      (scrollable)         │
└───────────────────────────┘
```

## 💡 Usage Tips

### Best Practices:
1. **Use the chart** to identify priority quadrants
2. **Use the list** for detailed task management
3. **Click dots** to quickly find specific tasks
4. **Sort the list** to focus on what matters
5. **Both views update together** - always synchronized

### Quadrant Strategy:
- **Q1 (Top Right):** Do First - high importance + urgency
- **Q2 (Top Left):** Schedule - high importance, low urgency
- **Q3 (Bottom Right):** Delegate - low importance, high urgency
- **Q4 (Bottom Left):** Eliminate - low importance + urgency

### Workflow Example:
1. Import 268 tasks from Google Sheets
2. View distribution in chart (left)
3. Sort by "Priority High → Low" (right)
4. Focus on Q1 tasks first
5. Click chart dots to jump to tasks
6. Complete tasks, see chart update instantly

## 🎨 Visual Benefits

### Why Split Screen?
- ✅ **See priorities visually** (chart) and textually (list)
- ✅ **No scrolling** to switch between views
- ✅ **Faster navigation** with click-to-select
- ✅ **Better overview** of task distribution
- ✅ **Simultaneous editing** and visualization
- ✅ **More efficient** workflow

### Eisenhower Matrix:
```
      Urgency →
    0  1  2  3  4  5  6  7  8  9  10
10  ┌──────────┬──────────┐  ↑
 9  │          │          │  │
 8  │    Q2    │    Q1    │  │
 7  │ Schedule │ Do First │  │
 6  │          │          │  │
 5  ├──────────┼──────────┤  Importance
 4  │          │          │  │
 3  │    Q4    │    Q3    │  │
 2  │ Eliminate│ Delegate │  │
 1  │          │          │  │
 0  └──────────┴──────────┘  ↓
```

## 🚀 Quick Start

1. **Import your tasks** via CSV (right side)
2. **View distribution** in chart (left side)
3. **Click dots** to select tasks
4. **Sort the list** by priority
5. **Start working** on Q1 tasks!

---

**Enjoy your new split-screen productivity workspace! 🎯**

