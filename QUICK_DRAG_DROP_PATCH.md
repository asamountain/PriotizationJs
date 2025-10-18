# 🚀 Quick Drag-Drop Subtask Patch

**Status:** Ready to Apply  
**Time:** ~5 minutes

Backend is ✅ DONE. Now add the frontend!

---

## 📝 Step 1: Add to `app.js` - In `data()` section

Find the `data()` section and add these properties:

```javascript
// Around line 145-155, add to the data object:
expandedTasks: new Set(),  // Track which parents are expanded
draggedTask: null,          // Track currently dragged task
```

---

## 📝 Step 2: Add to `app.js` - In `computed` section

Find where `sortedActiveTasks()` is and update it to filter root tasks only:

```javascript
sortedActiveTasks() {
  if (!this.activeTasks || this.activeTasks.length === 0) {
    return [];
  }
  
  // IMPORTANT: Only show root tasks (parent_id is null)
  const rootTasks = this.activeTasks.filter(task => !task.parent_id);
  
  // ... rest of existing sort logic stays the same ...
  // Just change `tasks` to `rootTasks` everywhere in this method
  
  return rootTasks;  // Return rootTasks instead of tasks
},

// ADD THIS NEW computed property:
getSubtasks(parentId) {
  if (!this.activeTasks) return [];
  return this.activeTasks.filter(task => task.parent_id === parentId);
},
```

---

## 📝 Step 3: Add to `app.js` - In `methods` section

Add these new methods (anywhere in methods section):

```javascript
// Drag-Drop Methods
handleDragStart(task, event) {
  this.draggedTask = task;
  event.dataTransfer.effectAllowed = 'move';
  event.target.style.opacity = '0.4';
},

handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  return false;
},

handleDropOnTask(parentTask, event) {
  event.stopPropagation();
  event.preventDefault();
  
  if (!this.draggedTask || this.draggedTask.id === parentTask.id) {
    return;
  }
  
  // Prevent making a parent into its own child
  if (this.isDescendant(parentTask.id, this.draggedTask.id)) {
    this.showNotification('Cannot create circular reference!', 'error');
    return;
  }
  
  // Set parent via socket
  this.socket.emit('setTaskParent', {
    taskId: this.draggedTask.id,
    parentId: parentTask.id
  });
  
  // Auto-expand parent
  this.expandedTasks.add(parentTask.id);
  
  this.showNotification(`Moved "${this.draggedTask.name}" under "${parentTask.name}"`, 'success');
},

handleDropOnRoot(event) {
  event.preventDefault();
  
  if (!this.draggedTask) return;
  
  this.socket.emit('setTaskParent', {
    taskId: this.draggedTask.id,
    parentId: null
  });
  
  this.showNotification(`Moved "${this.draggedTask.name}" to root level`, 'info');
},

handleDragEnd(event) {
  event.target.style.opacity = '1';
  this.draggedTask = null;
},

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

## 📝 Step 4: Update `index.html` - Active Tasks List

Find the active tasks list (around line 343) and replace it with this:

```html
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
        <!-- Expand/Collapse Button (if has subtasks) -->
        <v-btn
          v-if="getSubtasks(task.id).length > 0"
          icon
          size="x-small"
          variant="text"
          @click.stop="toggleExpand(task.id)"
          class="mr-2"
        >
          <v-icon size="small">
            {{ isExpanded(task.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
          </v-icon>
        </v-btn>
        <div v-else style="width: 32px;" class="mr-2"></div>
        
        <v-checkbox 
          :model-value="task.done" 
          @change="toggleTaskDone(task)"
          color="primary"
          hide-details
          @click.stop
        ></v-checkbox>
      </template>
      
      <!-- Keep all existing task content here (title, timer, chips, etc) -->
      
    </v-list-item>
    
    <!-- SUBTASKS (Nested, Indented) -->
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
        style="padding-left: 64px !important; cursor: move; background-color: rgba(0,0,0,0.02); border-left: 3px solid rgba(25, 118, 210, 0.3);"
      >
        <template v-slot:prepend>
          <v-icon size="small" class="mr-2" color="grey">
            mdi-subdirectory-arrow-right
          </v-icon>
          <v-checkbox 
            :model-value="subtask.done" 
            @change="toggleTaskDone(subtask)"
            color="primary"
            hide-details
            @click.stop
          ></v-checkbox>
        </template>
        
        <!-- Copy all the same content from parent task here -->
        
      </v-list-item>
    </template>
    
    <v-divider></v-divider>
  </template>
</v-list>

<!-- Drop Zone for Root Level (add at end of list) -->
<v-sheet
  v-if="draggedTask"
  @dragover="handleDragOver"
  @drop="handleDropOnRoot"
  class="mt-4 pa-6 text-center bg-primary-lighten-4 rounded"
  border
  style="border-style: dashed !important;"
>
  <v-icon color="primary" class="mb-2">mdi-arrow-up-bold-circle</v-icon>
  <div class="text-body-2 text-primary">Drop here to move to root level</div>
</v-sheet>
```

---

## 📝 Step 5: Add CSS Styles

Add to `<style>` section in `index.html`:

```css
/* Subtask styles */
.subtask {
  background-color: rgba(0, 0, 0, 0.02);
  border-left: 3px solid rgba(25, 118, 210, 0.3);
}

.dark-theme .subtask {
  background-color: rgba(255, 255, 255, 0.02);
}

.task.dragging {
  opacity: 0.4;
}

.task.drag-over {
  border: 2px dashed #1976D2 !important;
  background-color: rgba(25, 118, 210, 0.1);
}
```

---

## 🎯 How to Use

After applying the patch:

1. **Drag a task** onto another task → it becomes a subtask (indented)
2. **Click chevron** (▶/▼) to expand/collapse parent tasks
3. **Drag subtask** to the bottom drop zone → it becomes a root task again

**Timer data is preserved!** All your Pomodoro counts and time logs stay intact when moving tasks.

---

## ✅ Test It

1. Drag "Task A" onto "Task B" → A becomes subtask of B
2. Click ▶ next to B → expands to show A indented
3. Drag A to drop zone → A becomes root task again
4. Verify timer still running if it was before

---

**Questions?** See `SUBTASK_IMPLEMENTATION.md` for full details!

