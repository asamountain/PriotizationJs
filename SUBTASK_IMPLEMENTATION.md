# 🔄 Subtask & Parent-Child Task Hierarchy Implementation

**Status:** In Progress  
**Date:** October 18, 2025

---

## 🎯 Feature Overview

Add drag-and-drop functionality to organize tasks into hierarchical parent-child relationships while preserving all Pomodoro timer data.

### Key Requirements
1. ✅ Drag tasks to nest under other tasks (create subtasks)
2. ✅ Visual indentation for subtasks
3. ✅ Preserve timer data during parent_id changes
4. ✅ Expand/collapse parent tasks
5. ✅ Drag subtasks to root level to unlink

---

## 📊 Current Database Schema

Already supports parent-child with `parent_id` column:
```sql
tasks (
  id INTEGER PRIMARY KEY,
  name TEXT,
  parent_id INTEGER NULL,  -- NULL = root task, INT = subtask
  -- ... other fields including timer data
)
```

---

## 🏗️ Implementation Plan

### Phase 1: Backend API ✅
- Add `/api/tasks/:id/set-parent` endpoint
- Add socket handler for `setTaskParent` event
- Ensure timer data (total_time_spent, pomodoro_count, etc.) is preserved

### Phase 2: Frontend Logic ✅
- Update `sortedActiveTasks` to only show root tasks
- Add `getSubtasks(parentId)` computed property
- Add drag-and-drop handlers
- Add expand/collapse state management

### Phase 3: UI Updates ✅
- Add nested task rendering with indentation
- Add drag-and-drop visual feedback
- Add expand/collapse icons
- Add "drop zone" indicators

---

## 💻 Code Changes Needed

### 1. server.js - Add API Endpoint

```javascript
// Set parent for a task (preserves all timer data)
app.post("/api/tasks/:id/set-parent", async (req, res) => {
    try {
        const { id } = req.params;
        const { parentId } = req.body;
        
        const { setTaskParent } = await import("./db.js");
        
        // parentId can be null (make root) or a task ID
        await setTaskParent(parseInt(id), parentId ? parseInt(parentId) : null);
        
        res.json({ success: true });
    } catch (error) {
        console.error("Error setting task parent:", error);
        res.status(500).json({ error: "Failed to set task parent" });
    }
});
```

### 2. db.js - Add setTaskParent Method

```javascript
async setTaskParent(taskId, parentId) {
  return new Promise((resolve, reject) => {
    // Simply update parent_id - all other data (timers, notes, etc.) stays intact
    this.db.run(
      `UPDATE tasks SET parent_id = ? WHERE id = ?`,
      [parentId, taskId],
      function (err) {
        if (err) {
          console.error("Error setting task parent:", err);
          reject(err);
          return;
        }
        resolve({ taskId, parentId });
      }
    );
  });
}
```

### 3. socket.js - Add Socket Handler

```javascript
socket.on("setTaskParent", async ({ taskId, parentId }) => {
  try {
    const { setTaskParent } = await import("./db.js");
    await setTaskParent(taskId, parentId);
    
    // Broadcast update to all clients
    const tasks = await getTaskData();
    io.emit("tasksUpdated", processTaskData(tasks));
    
    socket.emit("taskParentSet", { taskId, parentId });
  } catch (error) {
    console.error("Error setting task parent:", error);
    socket.emit("error", { error: "Failed to set task parent" });
  }
});
```

### 4. app.js - Update Computed Properties

```javascript
// In computed section:
sortedActiveTasks() {
  if (!this.activeTasks || this.activeTasks.length === 0) {
    return [];
  }
  
  // Only show root tasks - subtasks rendered nested
  const rootTasks = this.activeTasks.filter(task => !task.parent_id);
  
  // ... existing sort logic ...
  return sortedRootTasks;
},

getSubtasks(parentId) {
  if (!this.activeTasks) return [];
  return this.activeTasks.filter(task => task.parent_id === parentId);
},

// In data section, add:
expandedTasks: new Set(), // Track which parent tasks are expanded
draggedTask: null, // Track currently dragged task
```

### 5. app.js - Add Drag-Drop Methods

```javascript
// Drag start
handleDragStart(task, event) {
  this.draggedTask = task;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/html', event.target.innerHTML);
  event.target.style.opacity = '0.4';
},

// Drag over (allow drop)
handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  return false;
},

// Drop on task (make it a subtask)
handleDropOnTask(parentTask, event) {
  event.stopPropagation();
  event.preventDefault();
  
  if (!this.draggedTask || this.draggedTask.id === parentTask.id) {
    return;
  }
  
  // Prevent circular reference (can't make parent a child of its child)
  if (this.isDescendant(parentTask.id, this.draggedTask.id)) {
    this.showNotification('Cannot create circular reference!', 'error');
    return;
  }
  
  // Set parent via socket
  this.socket.emit('setTaskParent', {
    taskId: this.draggedTask.id,
    parentId: parentTask.id
  });
  
  // Auto-expand parent to show new subtask
  this.expandedTasks.add(parentTask.id);
  
  this.showNotification(`Moved "${this.draggedTask.name}" under "${parentTask.name}"`, 'success');
},

// Drop on empty area (make it root task)
handleDropOnRoot(event) {
  event.preventDefault();
  
  if (!this.draggedTask) return;
  
  this.socket.emit('setTaskParent', {
    taskId: this.draggedTask.id,
    parentId: null
  });
  
  this.showNotification(`Moved "${this.draggedTask.name}" to root level`, 'info');
},

// Drag end
handleDragEnd(event) {
  event.target.style.opacity = '1';
  this.draggedTask = null;
},

// Check if task is descendant (prevent circular refs)
isDescendant(taskId, potentialAncestorId) {
  let currentTask = this.tasks.find(t => t.id === taskId);
  
  while (currentTask && currentTask.parent_id) {
    if (currentTask.parent_id === potentialAncestorId) {
      return true;
    }
    currentTask = this.tasks.find(t => t.id === currentTask.parent_id);
  }
  
  return false;
},

// Toggle expand/collapse
toggleExpand(taskId) {
  if (this.expandedTasks.has(taskId)) {
    this.expandedTasks.delete(taskId);
  } else {
    this.expandedTasks.add(taskId);
  }
},

isExpanded(taskId) {
  return this.expandedTasks.has(taskId);
},
```

---

## 🎨 UI Implementation (index.html)

### Update Task List Rendering

```html
<!-- Active Tasks List with Drag-Drop -->
<v-list v-if="activeTasks.length > 0">
  <template v-for="task in sortedActiveTasks" :key="task.id">
    <!-- Parent/Root Task -->
    <v-list-item
      :value="task.id"
      @click="selectTask(task)"
      @dblclick="editTaskNotes(task)"
      :data-task-id="task.id"
      class="task"
      draggable="true"
      @dragstart="handleDragStart(task, $event)"
      @dragover="handleDragOver"
      @drop="handleDropOnTask(task, $event)"
      @dragend="handleDragEnd"
      style="cursor: move;"
    >
      <template v-slot:prepend>
        <!-- Expand/Collapse Icon (if has subtasks) -->
        <v-btn
          v-if="getSubtasks(task.id).length > 0"
          icon
          size="x-small"
          variant="text"
          @click.stop="toggleExpand(task.id)"
          class="mr-2"
        >
          <v-icon>{{ isExpanded(task.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
        </v-btn>
        <div v-else style="width: 32px;"></div>
        
        <v-checkbox 
          :model-value="task.done" 
          @change="toggleTaskDone(task)"
          color="primary"
          hide-details
          @click.stop
        ></v-checkbox>
      </template>
      
      <!-- ... existing task content ... -->
    </v-list-item>
    
    <!-- Subtasks (Nested, Indented) -->
    <template v-if="isExpanded(task.id)">
      <v-list-item
        v-for="subtask in getSubtasks(task.id)"
        :key="subtask.id"
        :value="subtask.id"
        @click="selectTask(subtask)"
        @dblclick="editTaskNotes(subtask)"
        :data-task-id="subtask.id"
        class="task subtask"
        draggable="true"
        @dragstart="handleDragStart(subtask, $event)"
        @dragover="handleDragOver"
        @drop.stop="handleDropOnTask(subtask, $event)"
        @dragend="handleDragEnd"
        style="padding-left: 64px !important; cursor: move; background-color: rgba(0,0,0,0.02);"
      >
        <template v-slot:prepend>
          <v-icon size="small" class="mr-2" color="grey">mdi-subdirectory-arrow-right</v-icon>
          <v-checkbox 
            :model-value="subtask.done" 
            @change="toggleTaskDone(subtask)"
            color="primary"
            hide-details
            @click.stop
          ></v-checkbox>
        </template>
        
        <!-- ... existing task content (same as parent) ... -->
      </v-list-item>
    </template>
  </template>
</v-list>

<!-- Drop Zone for Root Level -->
<v-sheet
  v-if="draggedTask"
  @dragover="handleDragOver"
  @drop="handleDropOnRoot"
  class="mt-4 pa-6 text-center bg-primary-lighten-5 rounded"
  border
  style="border-style: dashed !important;"
>
  <v-icon color="primary" class="mb-2">mdi-arrow-up-bold-circle</v-icon>
  <div class="text-body-2 text-primary">Drop here to move to root level</div>
</v-sheet>
```

---

## 🎨 CSS Styles

```css
/* Drag and drop styles */
.task.dragging {
  opacity: 0.4;
}

.task.drag-over {
  border: 2px dashed #1976D2 !important;
  background-color: rgba(25, 118, 210, 0.1);
}

.subtask {
  padding-left: 64px !important;
  background-color: rgba(0, 0, 0, 0.02);
  border-left: 3px solid rgba(25, 118, 210, 0.3);
}

.dark-theme .subtask {
  background-color: rgba(255, 255, 255, 0.02);
}

/* Expand/collapse animation */
.subtask-enter-active, .subtask-leave-active {
  transition: all 0.3s ease;
}

.subtask-enter-from, .subtask-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
```

---

## ✅ Timer Data Preservation

### What Gets Preserved:
- ✅ `total_time_spent` - Cumulative time
- ✅ `active_timer_start` - Current timer state
- ✅ `pomodoro_count` - Completed pomodoros
- ✅ `last_worked_at` - Last activity timestamp
- ✅ All `time_logs` entries (foreign key maintained)

### How It Works:
The `setTaskParent` function **only updates `parent_id`**, leaving all other columns untouched. Since `time_logs` references `task_id` (not `parent_id`), all historical data remains linked correctly.

```sql
-- This is all we do:
UPDATE tasks SET parent_id = ? WHERE id = ?

-- Everything else stays the same!
```

---

## 🧪 Testing Checklist

- [ ] Drag task onto another task → becomes subtask
- [ ] Drag subtask to root zone → becomes root task
- [ ] Expand/collapse parent task → shows/hides subtasks
- [ ] Timer continues running during drag-drop
- [ ] Timer data preserved after parent change
- [ ] Time logs still accessible
- [ ] Pomodoro count unchanged
- [ ] Circular reference prevented
- [ ] Can't drag task onto itself
- [ ] Visual feedback during drag
- [ ] Subtasks show indentation
- [ ] Subtasks inherit nothing (independent data)

---

## 📖 User Guide

### Creating Subtasks
1. **Drag** any task
2. **Drop** it onto another task
3. It becomes a subtask (indented, with arrow icon)

### Moving to Root Level
1. **Drag** a subtask
2. **Drop** it in the "root level" drop zone at the bottom

### Expanding/Collapsing
1. Click **chevron icon** (▶/▼) next to parent tasks
2. Shows/hides subtasks

### Visual Indicators
- **▶ Chevron** = Collapsed (has subtasks)
- **▼ Chevron** = Expanded (showing subtasks)
- **↳ Arrow** = Subtask indicator
- **Indentation** = Hierarchy level
- **Dashed border** = Drop zone (while dragging)

---

## 🎯 Benefits

### Organization
- Group related tasks together
- Break large tasks into smaller steps
- Keep context organized

### Focus
- Collapse non-active parent tasks
- Reduce visual clutter
- Focus on current subtask

### Tracking
- Timer data independent per task
- Subtasks tracked separately
- Rollup totals possible (future feature)

---

## 🔮 Future Enhancements

### V2
- [ ] Rollup time totals (parent shows sum of children)
- [ ] Auto-complete parent when all subtasks done
- [ ] Bulk operations (complete all subtasks)
- [ ] Multi-level nesting (grandchild tasks)

### V3
- [ ] Task templates with subtasks
- [ ] Import/export hierarchy
- [ ] Gantt chart view
- [ ] Dependencies between subtasks

---

**Status:** Ready for implementation  
**Next Steps:** Apply code changes and test drag-drop functionality

