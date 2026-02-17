import { TaskManager } from './taskManager.js';
import { ChartVisualization } from './modules/chartVisualization.js';
import { TaskOperations } from './modules/taskOperations.js';
import { TaskListManager } from './modules/taskListManager.js';

// Define these variables at the top level so they can be exported
let chartVisualization = null;
let taskOperations = null;
let taskListManager = null;

// Wait for DOM and resources to be fully loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing app');
  
  // Make sure Vuetify is properly loaded
  if (typeof Vuetify === 'undefined') {
    console.error('Vuetify not loaded! Check your script imports.');
    document.body.innerHTML = '<div style="color:red;padding:20px;">Error: Vuetify library not loaded. Please check your internet connection and reload the page.</div>';
    return;
  }
  
  // Create Vuetify instance
  const vuetify = Vuetify.createVuetify({
    theme: {
      defaultTheme: localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light',
      themes: {
        light: {
          colors: {
            primary: '#255035', // Deep Forest Green
            secondary: '#449461', // Mid Green
            accent: '#63D88E', // Seafoam Green
            error: '#34724B', // Muted dark green
            warning: '#54B678',
            info: '#68E195', // Bright Seafoam
            success: '#449461',
            background: '#f4f9f6', // Very light clean tint
            surface: '#ffffff',
          },
        },
        dark: {
          colors: {
            primary: '#68E195',
            secondary: '#449461',
            accent: '#255035',
            error: '#34724B',
            warning: '#54B678',
            info: '#63D88E',
            success: '#68E195',
            background: '#0d1410',
            surface: '#161f1a',
          },
        },
      },
    },
  });
  
  // Initialize modules - assign to the global variables we defined earlier
  chartVisualization = new ChartVisualization();
  taskOperations = new TaskOperations();
  taskListManager = new TaskListManager();
  
  // Create Vue app with Vuetify
  const app = Vue.createApp({
    data() {
      return {
        tasks: [],
        activeTasks: [],
        completedTasks: [],
        taskName: '',
        taskImportance: 5,
        taskUrgency: 5,
        taskLink: '',
        taskDueDate: null,
        isDarkTheme: localStorage.getItem('isDarkTheme') === 'true',
        theme: localStorage.getItem('isDarkTheme') === 'true' ? 'dark' : 'light',
        quadrantStats: { q1: 0, q2: 0, q3: 0, q4: 0 },
        newSubtask: {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        },
        showSubtaskModal: false,
        parentId: null,
        showCompletedSubtasks: false,
        showNotSureTasks: false,
        taskSectionOpen: {
          active: true,
          completed: false
        },
        showEditForm: false,
        editingSubtask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline'
        },
        showTaskEditForm: false,
        editingTask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline'
        },
        possibleParents: [],
        snackbar: {
          show: false,
          text: '',
          color: 'primary',
          timeout: 3000
        },
        socket: null,
        showNotesDialog: false,
        editingNotes: '',
        currentTask: null,
        noteTaskId: null,
        csvFile: null,
        csvImporting: false,
        csvImportResult: null,
        taskSortBy: localStorage.getItem('taskSortBy') || 'priority-high', // Default sort
        taskSortOptions: [
          { value: 'priority-high', title: '🔥 Priority (High → Low)' },
          { value: 'priority-low', title: '❄️ Priority (Low → High)' },
          { value: 'importance-high', title: '⭐ Importance (High → Low)' },
          { value: 'importance-low', title: '⭐ Importance (Low → High)' },
          { value: 'urgency-high', title: '⚡ Urgency (High → Low)' },
          { value: 'urgency-low', title: '⚡ Urgency (Low → High)' },
          { value: 'newest', title: '🆕 Newest First' },
          { value: 'oldest', title: '📅 Oldest First' },
          { value: 'due-date', title: '⏰ Due Date (Closest)' },
          { value: 'name-az', title: '🔤 Name (A → Z)' }
        ],
        leftPanelWidth: parseFloat(localStorage.getItem('leftPanelWidth')) || 55,
        isResizing: false,
        showCsvImportDialog: false,
        showQuickAddModal: false,
        quickAddTask: {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          notes: '',
          icon: 'mdi-checkbox-blank-circle-outline'
        },
        availableIcons: [
          'mdi-checkbox-blank-circle-outline',
          'mdi-star',
          'mdi-lightning-bolt',
          'mdi-fire',
          'mdi-water',
          'mdi-earth',
          'mdi-airballoon',
          'mdi-rocket',
          'mdi-target',
          'mdi-flag',
          'mdi-alert-circle',
          'mdi-check-circle',
          'mdi-clock',
          'mdi-calendar',
          'mdi-book',
          'mdi-code-tags',
          'mdi-laptop',
          'mdi-phone',
          'mdi-email',
          'mdi-home',
          'mdi-briefcase',
          'mdi-account',
          'mdi-group',
          'mdi-heart',
          'mdi-coffee',
          'mdi-food',
          'mdi-cart',
          'mdi-finance',
          'mdi-chart-line',
          'mdi-lightbulb'
        ],
        // Timer state
        timerInterval: null,
        currentTime: Date.now(),
        completedPomodoros: new Set(),
        showBreakDialog: false,
        breakTask: null,
        breakType: 'short', // 'short' (5min) or 'long' (15min)
        breakTimeRemaining: 0,
        breakInterval: null,
        // Drag and drop state
        draggedTask: null,
        dragOverTaskId: null,
        expandedTasks: new Set(),
        // Authentication state
        user: null,
        authConfig: {
          googleEnabled: false
        },
        hoveredTaskId: null,
        heartbeatInterval: null,
        isSessionExpired: false
      };
    },
    computed: {
      hoveredTaskAncestors() {
        if (!this.hoveredTaskId) return new Set();
        const ancestors = new Set();
        let current = this.tasks.find(t => t.id === this.hoveredTaskId);
        while (current && current.parent_id) {
          ancestors.add(current.parent_id);
          current = this.tasks.find(t => t.id === current.parent_id);
        }
        return ancestors;
      },
      currentTheme() {
        return this.isDarkTheme ? 'dark' : 'light';
      },
      hasCompletedTasks() {
        return this.completedTasks && this.completedTasks.length > 0;
      },
      chartStyle() {
        // In split view, chart always fills its container
        return {
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'visible'
        };
      },
      sortedActiveTasks() {
        if (!this.activeTasks || this.activeTasks.length === 0) {
          return [];
        }
        
        let tasks = [...this.activeTasks];

        // Filter out "Not Sure" tasks if hidden
        if (!this.showNotSureTasks) {
          tasks = tasks.filter(task => task.status !== 'Not Sure');
        }
        
        switch (this.taskSortBy) {
          case 'priority-high':
            return tasks.sort((a, b) => {
              const priorityA = a.importance * a.urgency;
              const priorityB = b.importance * b.urgency;
              return priorityB - priorityA;
            });
          
          case 'priority-low':
            return tasks.sort((a, b) => {
              const priorityA = a.importance * a.urgency;
              const priorityB = b.importance * b.urgency;
              return priorityA - priorityB;
            });
          
          case 'importance-high':
            return tasks.sort((a, b) => b.importance - a.importance);
          
          case 'importance-low':
            return tasks.sort((a, b) => a.importance - b.importance);
          
          case 'urgency-high':
            return tasks.sort((a, b) => b.urgency - a.urgency);
          
          case 'urgency-low':
            return tasks.sort((a, b) => a.urgency - b.urgency);
          
          case 'newest':
            return tasks.sort((a, b) => {
              return new Date(b.created_at) - new Date(a.created_at);
            });
          
          case 'oldest':
            return tasks.sort((a, b) => {
              return new Date(a.created_at) - new Date(b.created_at);
            });
          
          case 'due-date':
            return tasks.sort((a, b) => {
              if (!a.due_date && !b.due_date) return 0;
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date) - new Date(b.due_date);
            });
          
          case 'name-az':
            return tasks.sort((a, b) => a.name.localeCompare(b.name));
          
          default:
            return tasks;
        }
      }
    },
    methods: {
      toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        this.theme = this.isDarkTheme ? 'dark' : 'light';
        localStorage.setItem('isDarkTheme', this.isDarkTheme);
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        
        // Update chart colors
        if (chartVisualization && typeof chartVisualization.updateChartColors === 'function') {
          chartVisualization.updateChartColors();
        }
      },
      
      submitTask() {
        if (!this.taskName) return;
        
        const taskData = {
          name: this.taskName,
          importance: this.taskImportance,
          urgency: this.taskUrgency,
          link: this.taskLink || null,
          due_date: this.taskDueDate || null
        };
        
        taskOperations.addTask(taskData);
        
        // Reset form
              this.taskName = '';
              this.taskImportance = 5;
              this.taskUrgency = 5;
        this.taskLink = '';
        this.taskDueDate = null;
      },
      
      toggleTaskDone(task) {
        taskOperations.toggleDone(task.id);
      },
      
      deleteTask(taskId, taskName) {
        // One-click delete - no confirmation dialog
        taskOperations.deleteTask(taskId);
        this.showNotification(`Deleted: ${taskName || 'Task'}`, 'info');
      },
      
      getSubtasksForTask(taskId) {
        let subtasks = this.tasks.filter(task => task.parent_id === taskId);
        
        // Filter out "Not Sure" subtasks if hidden
        if (!this.showNotSureTasks) {
          subtasks = subtasks.filter(task => task.status !== 'Not Sure');
        }

        // Debug logging for subtasks with links
        subtasks.forEach(subtask => {
          if (subtask.link) {
            console.log(`UI: Displaying subtask ${subtask.id} with link: ${subtask.link}`);
          }
        });
        
        return subtasks;
      },
      
      showAddSubtaskForm(taskId) {
        this.parentId = taskId;
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
        this.showSubtaskModal = true;
      },
      
      closeSubtaskModal() {
        this.showSubtaskModal = false;
        this.parentId = null;
      },
      
      addSubtask() {
        if (!this.newSubtask.name || !this.parentId) return;
        
        taskOperations.addSubtask(this.newSubtask, this.parentId);
        
        this.showSubtaskModal = false;
        this.parentId = null;
        
        // Reset the newSubtask object
        this.newSubtask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
      },
      
      selectTask(task) {
        if (chartVisualization) {
          chartVisualization.focusOnTask(task.id);
        }
      },
      
      editSubtask(subtask) {
        this.editingSubtask = { ...subtask };
        this.possibleParents = [
          { id: null, name: 'No Parent (Root Task)' },
          ...this.activeTasks.filter(t => t.id !== subtask.id) // Exclude self to avoid circularity
        ];
        this.showEditForm = true;
      },
      
      saveSubtaskEdit() {
        if (!this.editingSubtask.name) return;
        
        console.log("UI: Saving subtask edit:");
        console.log("UI: Subtask ID:", this.editingSubtask.id);
        console.log("UI: Subtask link before saving:", this.editingSubtask.link);
        console.log("UI: Subtask parent_id:", this.editingSubtask.parent_id);
        
        // Ensure link is properly formatted
        if (this.editingSubtask.link && typeof this.editingSubtask.link === 'string') {
          // Add http:// prefix if missing
          if (!/^https?:\/\//i.test(this.editingSubtask.link)) {
            this.editingSubtask.link = 'http://' + this.editingSubtask.link;
            console.log("UI: Added http:// prefix to link:", this.editingSubtask.link);
          }
        }
        
        console.log("UI: Final subtask link value being sent:", this.editingSubtask.link);
        
        // Update task content (name, link, etc.)
        taskOperations.updateSubtask(this.editingSubtask);

        // Update parent relationship if changed (including to null)
        const originalTask = this.tasks.find(t => t.id === this.editingSubtask.id);
        if (originalTask && originalTask.parent_id !== this.editingSubtask.parent_id) {
          console.log(`Parent changed from ${originalTask.parent_id} to ${this.editingSubtask.parent_id}`);
          this.socket.emit('setTaskParent', {
            taskId: this.editingSubtask.id,
            parentId: this.editingSubtask.parent_id
          });
        }
        
        this.showNotification("Saving subtask with link: " + (this.editingSubtask.link || "none"), "info");
        
        this.showEditForm = false;
        this.editingSubtask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          parent_id: null,
          link: '',
          due_date: null
        };
      },
      
      cancelEdit() {
        this.showEditForm = false;
      },
      
      editTask(task) {
        this.editingTask = { ...task };
        this.showTaskEditForm = true;
      },
      
      saveTaskEdit() {
        if (!this.editingTask.name) return;
        
        taskOperations.editTask(this.editingTask);
        
        this.showTaskEditForm = false;
        this.editingTask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
        };
      },
      
      cancelTaskEdit() {
        this.showTaskEditForm = false;
      },
      
      toggleTaskSection(section) {
        this.taskSectionOpen[section] = !this.taskSectionOpen[section];
      },
      
      toggleCompletedSubtasks() {
        this.showCompletedSubtasks = !this.showCompletedSubtasks;
      },
      
      toggleNotSureTasks() {
        this.showNotSureTasks = !this.showNotSureTasks;
        const msg = this.showNotSureTasks ? 'Showing "Not Sure" tasks' : 'Hiding "Not Sure" tasks';
        this.showNotification(msg, 'info');
      },
      
      updateTasks(tasks) {
        console.log('updateTasks received:', tasks.length, 'tasks');
        this.tasks = tasks;
        
        // Helper to check if a task's parent exists
        const parentExists = (parentId) => {
          if (!parentId) return false;
          return tasks.some(t => Number(t.id) === Number(parentId));
        };

        // A task is a "root" if it has no parent_id OR if its parent doesn't exist
        const rawActive = tasks.filter(task => !task.done && (!task.parent_id || !parentExists(task.parent_id)));
        const rawCompleted = tasks.filter(task => task.done && (!task.parent_id || !parentExists(task.parent_id)));
        
        console.log('Filtered Active (root/orphaned):', rawActive.length);
        console.log('Filtered Completed (root/orphaned):', rawCompleted.length);

        this.activeTasks = rawActive;
        this.completedTasks = rawCompleted;
        
        // Re-render the chart with updated tasks (only if chart is initialized)
        if (chartVisualization && typeof chartVisualization.renderChart === 'function' && chartVisualization.dotsGroup) {
          chartVisualization.renderChart(tasks);
        }
      },

      formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      },

      formatLinkDisplay(url) {
        if (!url) return 'No link';
        try {
          const urlObj = new URL(url);
          let displayText = urlObj.hostname;
          if (urlObj.pathname && urlObj.pathname !== '/') {
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            if (pathParts.length > 0) {
              const firstPart = pathParts[0];
              if (firstPart.length < 10) {
                displayText += '/' + firstPart;
                if (pathParts.length > 1) {
                  displayText += '/...';
                }
              }
            }
          }
          return displayText || url;
        } catch (e) {
          return url.length > 20 ? url.substring(0, 18) + '...' : url;
        }
      },
      
      showNotification(text, color = 'primary', timeout = 3000) {
        this.snackbar = {
          show: true,
          text,
          color,
          timeout
        };
      },
      
      editTaskNotes(task) {
        const socket = this.socket || window.socket;
        if (socket) {
          socket.emit('getTaskDetails', { taskId: task.id });
          socket.once('taskDetails', (taskData) => {
            if (taskData && taskData.id === task.id) {
              this.currentTask = taskData;
              this.editingNotes = taskData.notes || '';
              this.noteTaskId = task.id;
              this.showNotesDialog = true;
            }
          });
        }
      },
      
      saveTaskNotes() {
        if (!this.currentTask) return;
        taskOperations.updateTaskNotes(this.currentTask.id, this.editingNotes);
        const taskIndex = this.tasks.findIndex(t => t.id === this.currentTask.id);
        if (taskIndex >= 0) {
          this.tasks[taskIndex] = { ...this.tasks[taskIndex], notes: this.editingNotes };
        }
        this.showNotesDialog = false;
      },

      async importCSV() {
        if (!this.csvFile) {
          this.showNotification('Please select a CSV file', 'error');
          return;
        }
        this.csvImporting = true;
        try {
          const formData = new FormData();
          formData.append('csvFile', this.csvFile[0]);
          const response = await fetch('/api/import-csv', { method: 'POST', body: formData });
          const result = await response.json();
          if (response.ok) {
            this.showNotification(result.message, 'success');
            this.csvFile = null;
            setTimeout(() => { this.showCsvImportDialog = false; }, 2000);
          } else {
            this.showNotification('Failed to import CSV: ' + (result.message || 'Unknown error'), 'error');
          }
        } catch (error) {
          this.showNotification('Error uploading CSV file', 'error');
        } finally {
          this.csvImporting = false;
        }
      },

      exportTasks() {
        const tasks = this.tasks;
        if (!tasks || tasks.length === 0) {
          this.showNotification('No tasks to export', 'warning');
          return;
        }
        const headers = ['id', 'name', 'importance', 'urgency', 'done', 'link', 'due_date', 'notes', 'parent_id', 'created_at', 'completed_at', 'total_time_spent', 'pomodoro_count', 'category', 'status'];
        const csvRows = [headers.join(',')];
        for (const task of tasks) {
          const values = headers.map(header => {
            let val = task[header] ?? '';
            if (header === 'done') val = val ? 'true' : 'false';
            let stringVal = val.toString();
            if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
              stringVal = `"${stringVal.replace(/"/g, '""')}"`;
            }
            return stringVal;
          });
          csvRows.push(values.join(','));
        }
        const csvContent = "\uFEFF" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `tasks-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.click();
        this.showNotification('Tasks exported successfully', 'success');
      },


      openQuickAddModal(importance, urgency) {
        this.quickAddTask.importance = importance;
        this.quickAddTask.urgency = urgency;
        this.quickAddTask.name = '';
        this.quickAddTask.link = '';
        this.quickAddTask.notes = '';
        this.showQuickAddModal = true;
      },

      submitQuickTask() {
        if (!this.quickAddTask.name) {
          this.showNotification('Please enter a task name', 'error');
          return;
        }

        const taskData = {
          name: this.quickAddTask.name,
          importance: this.quickAddTask.importance,
          urgency: this.quickAddTask.urgency,
          link: this.quickAddTask.link || null,
          notes: this.quickAddTask.notes || null
        };

        // Use taskOperations to ensure proper real-time updates
        taskOperations.addTask(taskData);
        this.showNotification(`Added: ${taskData.name}`, 'success');
        
        // Close modal and reset
        this.showQuickAddModal = false;
        this.quickAddTask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          notes: ''
        };
      },

      closeQuickAddModal() {
        this.showQuickAddModal = false;
      },

      // Pomodoro Timer Methods
      toggleTimer(task) {
        if (task.active_timer_start) {
          // Stop timer
          this.socket.emit('stopTimer', task.id);
          this.showNotification(`Timer stopped for: ${task.name}`, 'info');
        } else {
          // Start timer
          this.socket.emit('startTimer', task.id);
          this.showNotification(`Timer started for: ${task.name}`, 'success');
        }
      },

      formatTime(seconds) {
        if (!seconds) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
          return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
      },

      getElapsedTime(startTime) {
        if (!startTime) return 0;
        const start = new Date(startTime).getTime();
        const now = this.currentTime;
        return Math.floor((now - start) / 1000);
      },

      startTimerUpdates() {
        // Update current time every second for active timers
        this.timerInterval = setInterval(() => {
          this.currentTime = Date.now();
          this.checkPomodoroCompletion();
        }, 1000);
      },

      checkPomodoroCompletion() {
        // Check if any task has reached 25 minutes
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
      },

      onPomodoroComplete(task) {
        // Auto-stop the timer
        this.socket.emit('stopTimer', task.id);
        
        // Play chime sound
        this.playCompletionChime();
        
        // Show break dialog
        this.breakTask = task;
        // Every 4th pomodoro gets a long break
        this.breakType = (task.pomodoro_count % 4 === 0) ? 'long' : 'short';
        this.showBreakDialog = true;
        
        // Show notification
        this.showNotification(`🍅 Pomodoro completed for: ${task.name}! Time for a break!`, 'success');
      },

      playCompletionChime() {
        // Create a pleasant chime sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create a pleasant three-tone chime
        const playTone = (frequency, startTime, duration) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = frequency;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };
        
        const now = audioContext.currentTime;
        playTone(523.25, now, 0.3);        // C5
        playTone(659.25, now + 0.15, 0.3); // E5
        playTone(783.99, now + 0.3, 0.5);  // G5
      },

      startBreak() {
        const duration = this.breakType === 'long' ? 15 * 60 : 5 * 60; // seconds
        this.breakTimeRemaining = duration;
        this.showBreakDialog = false;
        
        // Store break start time in localStorage for persistence
        const breakData = {
          startTime: Date.now(),
          duration: duration,
          taskName: this.breakTask ? this.breakTask.name : 'Task'
        };
        localStorage.setItem('activeBreak', JSON.stringify(breakData));
        
        // Start break timer
        this.breakInterval = setInterval(() => {
          this.breakTimeRemaining--;
          if (this.breakTimeRemaining <= 0) {
            this.endBreak();
          }
        }, 1000);
        
        const breakLength = this.breakType === 'long' ? '15 min' : '5 min';
        this.showNotification(`☕ Break started (${breakLength}). Relax!`, 'info');
      },

      skipBreak() {
        this.showBreakDialog = false;
        this.breakTask = null;
      },

      endBreak() {
        if (this.breakInterval) {
          clearInterval(this.breakInterval);
          this.breakInterval = null;
        }
        this.breakTimeRemaining = 0;
        
        // Clear break from localStorage
        localStorage.removeItem('activeBreak');
        
        // Play completion chime
        this.playCompletionChime();
        
        // Notify user
        this.showNotification('✅ Break complete! Ready for another Pomodoro?', 'success');
      },
      
      // Restore break timer if it was active
      restoreBreakTimer() {
        const breakData = localStorage.getItem('activeBreak');
        if (!breakData) return;
        
        try {
          const { startTime, duration, taskName } = JSON.parse(breakData);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = duration - elapsed;
          
          if (remaining > 0) {
            // Break is still active
            this.breakTimeRemaining = remaining;
            
            // Restart interval
            this.breakInterval = setInterval(() => {
              this.breakTimeRemaining--;
              if (this.breakTimeRemaining <= 0) {
                this.endBreak();
              }
            }, 1000);
            
            console.log(`Restored break timer: ${remaining}s remaining for ${taskName}`);
          } else {
            // Break should have ended while away
            localStorage.removeItem('activeBreak');
            this.showNotification('✅ Break completed while you were away!', 'success');
            this.playCompletionChime();
          }
        } catch (error) {
          console.error('Error restoring break timer:', error);
          localStorage.removeItem('activeBreak');
        }
      },

      stopTimerUpdates() {
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
      },

      // Resize panel methods
      startResize(e) {
        this.isResizing = true;
        const move = (e) => {
          if (!this.isResizing) return;
          const rect = this.$refs.splitContainer.getBoundingClientRect();
          const width = ((e.clientX - rect.left) / rect.width) * 100;
          if (width >= 30 && width <= 70) {
            this.leftPanelWidth = width;
            this.$nextTick(() => chartVisualization.initializeChart());
          }
        };
        const stop = () => {
          this.isResizing = false;
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', stop);
          localStorage.setItem('leftPanelWidth', this.leftPanelWidth);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
      },

      handleDragStart(task, event) {
        console.log("Dragging task:", task.id, task.name);
        this.draggedTask = task;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', task.id);
        
        // Add dragging class for visual feedback
        setTimeout(() => {
          if (event.target && event.target.classList) {
            event.target.classList.add('dragging');
          }
        }, 0);
      },

      handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        // Find the task element being dragged over
        const taskEl = event.target.closest('.task, .subtask');
        if (taskEl) {
          const taskId = parseInt(taskEl.dataset.taskId || taskEl.dataset.subtaskId);
          if (taskId && this.draggedTask && taskId !== this.draggedTask.id) {
            this.dragOverTaskId = taskId;
            taskEl.classList.add('drag-over');
          }
        }
        return false;
      },

      handleDragLeave(event) {
        const taskEl = event.target.closest('.task, .subtask');
        if (taskEl) {
          taskEl.classList.remove('drag-over');
        }
      },

      handleDropOnTask(parentTask, event) {
        event.stopPropagation();
        event.preventDefault();
        
        // Clear drag-over styling
        const taskEl = event.target.closest('.task, .subtask');
        if (taskEl) taskEl.classList.remove('drag-over');

        if (!this.draggedTask || this.draggedTask.id === parentTask.id) {
          return;
        }

        // Prevent circular reference
        if (this.isDescendant(parentTask.id, this.draggedTask.id)) {
          this.showNotification('Cannot create circular reference!', 'error');
          return;
        }

        console.log(`Setting parent of ${this.draggedTask.id} to ${parentTask.id}`);
        this.socket.emit('setTaskParent', {
          taskId: this.draggedTask.id,
          parentId: parentTask.id
        });

        // Auto-expand parent to show new subtask
        this.expandedTasks.add(parentTask.id);
        this.expandedTasks = new Set(this.expandedTasks);

        this.showNotification(`Moved "${this.draggedTask.name}" under "${parentTask.name}"`, 'success');
      },

      handleDropOnRoot(event) {
        event.preventDefault();
        event.target.classList.remove('drag-over');
        
        if (!this.draggedTask) return;

        console.log(`Moving ${this.draggedTask.id} to root level`);
        this.socket.emit('setTaskParent', {
          taskId: this.draggedTask.id,
          parentId: null
        });

        this.showNotification(`Moved "${this.draggedTask.name}" to root level`, 'info');
      },

      handleDragEnd(event) {
        if (event.target && event.target.classList) {
          event.target.classList.remove('dragging');
        }
        
        // Remove drag-over class from all elements
        document.querySelectorAll('.task, .subtask, .empty-drop-area, #empty-drop-area').forEach(el => {
          el.classList.remove('drag-over');
        });
        
        this.draggedTask = null;
        this.dragOverTaskId = null;
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

      toggleExpand(taskId, force) {
        if (force === true) {
          this.expandedTasks.add(taskId);
        } else if (force === false) {
          this.expandedTasks.delete(taskId);
        } else {
          if (this.expandedTasks.has(taskId)) {
            this.expandedTasks.delete(taskId);
          } else {
            this.expandedTasks.add(taskId);
          }
        }
        // Force reactivity update for Set
        this.expandedTasks = new Set(this.expandedTasks);
      },

      isExpanded(taskId) {
        return this.expandedTasks.has(taskId);
      },

      toggleNotSure(task) {
        taskOperations.toggleTaskStatus(task.id, task.status);
        const statusMsg = task.status === 'Not Sure' ? 'Cleared "Not Sure" status' : 'Tagged as "Not Sure"';
        this.showNotification(`${statusMsg}: ${task.name}`, 'info');
      },

      // Authentication methods
      async checkAuth() {
        try {
          // Fetch auth config if not already fetched
          if (!this.authConfig.googleEnabled) {
            const configResponse = await fetch('/api/auth/config');
            if (configResponse.ok) {
              this.authConfig = await configResponse.json();
            }
          }

          // Fetch current user
          const response = await fetch('/api/auth/user');
          if (response.ok) {
            const userData = await response.json();
            this.user = userData;
            this.isSessionExpired = false;
            console.log('User authenticated:', this.user);
            
            // Authenticate socket connection
            this.authenticateSocket();
          } else {
            if (this.user) {
              // User was logged in but session expired
              this.isSessionExpired = true;
              this.showNotification('Session expired. Please log in again to save your progress.', 'warning', 10000);
            }
            this.user = null;
          }
          
          // Always start heartbeat to keep server awake and session fresh
          this.startHeartbeat();
        } catch (error) {
          console.error('Error checking auth:', error);
          // Start heartbeat anyway to try and maintain connection
          this.startHeartbeat();
        }
      },

      authenticateSocket() {
        if (this.socket && this.user && this.user.id) {
          console.log('Authenticating socket for user:', this.user.id);
          this.socket.emit('authenticate', this.user.id);
        }
      },

      startHeartbeat() {
        if (this.heartbeatInterval) return;
        
        console.log('Starting heartbeat to keep session/server alive');
        // Ping every 4 minutes to keep session active (especially for Render spin-down)
        this.heartbeatInterval = setInterval(async () => {
          try {
            const response = await fetch('/api/auth/heartbeat');
            const wasLoggedIn = !!this.user;
            
            if (response.ok) {
              const data = await response.json();
              if (!wasLoggedIn && data.authenticated) {
                // Unexpectedly logged in (maybe in another tab)
                this.checkAuth();
              }
              this.isSessionExpired = false;
            } else if (response.status === 401) {
              if (wasLoggedIn) {
                console.warn('Heartbeat: Session expired');
                this.user = null;
                this.isSessionExpired = true;
                this.showNotification('Session expired. Please log in again.', 'warning');
                // Don't clear interval, keep pinging to keep server awake
              }
            }
          } catch (error) {
            console.error('Heartbeat error:', error);
          }
        }, 4 * 60 * 1000); 
      },

      loginWithGoogle() {
        window.location.href = '/auth/google';
      },

      logout() {
        window.location.href = '/auth/logout';
      },

      updateTaskIcon(task, icon) {
        task.icon = icon;
        this.socket.emit('editTask', task);
        this.showNotification('Icon updated', 'success');
      },

      getPriorityColor(value) {
        if (value >= 8) return 'error';
        if (value >= 6) return 'warning';
        if (value >= 4) return 'info';
        return 'success';
      },

      indentTask(task) {
        // Find siblings at the same level
        const siblings = this.tasks.filter(t => t.parent_id === task.parent_id);
        const currentIndex = siblings.findIndex(t => t.id === task.id);
        
        if (currentIndex > 0) {
          const previousSibling = siblings[currentIndex - 1];
          this.socket.emit('setTaskParent', {
            taskId: task.id,
            parentId: previousSibling.id
          });
          this.expandedTasks.add(previousSibling.id);
          this.expandedTasks = new Set(this.expandedTasks);
          this.showNotification(`Moved "${task.name}" inside "${previousSibling.name}"`, 'success');
        } else {
          this.showNotification('No task above to indent under', 'warning');
        }
      },

      outdentTask(task) {
        if (!task.parent_id) return;

        const parentTask = this.tasks.find(t => t.id === task.parent_id);
        const grandParentId = parentTask ? parentTask.parent_id : null;

        this.socket.emit('setTaskParent', {
          taskId: task.id,
          parentId: grandParentId
        });
        this.showNotification(`Moved "${task.name}" to parent level`, 'info');
      },
    },
    watch: {
      taskSortBy(newValue) {
        // Save sort preference to localStorage
        localStorage.setItem('taskSortBy', newValue);
      }
    },
    provide() {
      return {
        openQuickAddModal: this.openQuickAddModal
      };
    },
    beforeUnmount() {
      // Clean up resize listeners
      if (this.isResizing) {
        document.removeEventListener('mousemove', this.handleResize);
        document.removeEventListener('mouseup', this.stopResize);
      }
      // Clean up timer interval
      this.stopTimerUpdates();
      // Clean up heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    },
    mounted() {
      // Make app globally available FIRST
      window.app = this;
      
      // Check authentication
      this.checkAuth();
      
      // Initialize chart BEFORE socket connection to avoid race condition
      this.$nextTick(() => {
        if (chartVisualization) {
          console.log('Initializing chart before socket connection');
          chartVisualization.initializeChart();
        }
      });
      
      // Initialize socket connection AFTER chart setup
      this.socket = io(window.location.origin, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });
      
      // Listen for socket connection and request data
      this.socket.on('connect', () => {
        console.log('Socket connected, checking auth and requesting initial data');
        // Always try to authenticate the socket when it connects/reconnects
        this.authenticateSocket();
        this.socket.emit('requestInitialData');
      });
      
      this.socket.on('reconnect', () => {
        console.log('Socket reconnected');
        this.authenticateSocket();
      });
      
      // Handle initial data and updates
      this.socket.on('initialData', (data) => {
        console.log('Received initial data:', data);
        if (data && data.data) {
          this.updateTasks(data.data);
        }
      });
      
      this.socket.on('updateTasks', (data) => {
        console.log('Received task update:', data);
        if (data && data.data) {
          this.updateTasks(data.data);
        }
      });

      this.socket.on('csvImported', (result) => {
        console.log('CSV import completed:', result);
        // Refresh the task list
        this.socket.emit('updateTasks');
      });
      
      // Listen for updates from task modules
      window.addEventListener('tasksUpdated', (event) => {
        if (event.detail && event.detail.tasks) {
          this.updateTasks(event.detail.tasks);
        }
      });
      
      // Share the Vue instance with modules
      window.taskManager = window.taskManager || {};
      window.taskManager.setVueApp?.(this);
      
      // Apply dark theme if active
        if (this.isDarkTheme) {
          document.body.classList.add('dark-theme');
      }
      
      // Start timer updates for active timers
      this.startTimerUpdates();
      
      // Restore break timer if it was active (handles page navigation/refresh)
      this.restoreBreakTimer();
      
      // Dispatch event to signal that app is mounted
      window.dispatchEvent(new Event('app-mounted'));
    },
    beforeUnmount() {
      // Clean up timer interval
      this.stopTimerUpdates();
    }
  });
  
  // Define recursive task-node component
  app.component('task-node', {
    props: ['task', 'depth', 'tasks', 'expandedTasks', 'showCompletedSubtasks'],
    template: `
      <div 
        :class="['task-node-container', isHovered ? 'branch-hover' : '']" 
        @mouseenter.stop="onMouseEnter"
        @mouseleave.stop="onMouseLeave"
      >
        <v-list-item
          :value="task.id"
          @click="$root.selectTask(task)"
          @dblclick="$root.showAddSubtaskForm(task.id)"
          :data-task-id="task.id" 
          :class="['task-item', depth > 0 ? 'subtask' : '', task.active_timer_start ? 'timer-active' : '']"
          style="cursor: grab;"
          draggable="true"
          @dragstart="$root.handleDragStart(task, $event)"
          @dragover="$root.handleDragOver"
          @dragleave="$root.handleDragLeave"
          @drop.stop="$root.handleDropOnTask(task, $event)"
          @dragend="$root.handleDragEnd"
        >
          <template v-slot:prepend>
            <div class="d-flex align-center toggle-junction gap-2 me-3" style="min-width: 64px;">
              <v-btn
                v-if="hasChildren"
                icon
                size="x-small"
                variant="text"
                @click.stop="$root.toggleExpand(task.id)"
                class="expand-btn"
              >
                <v-icon size="20">{{ isExpanded ? 'mdi-menu-down' : 'mdi-menu-right' }}</v-icon>
              </v-btn>
              <div v-else style="width: 24px;"></div>
              
              <v-menu location="bottom start">
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon
                    size="small"
                    variant="text"
                    v-bind="props"
                    :color="task.done ? 'grey' : getPriorityColor(task.importance)"
                    @click.stop
                  >
                    <v-icon size="24">{{ task.icon || 'mdi-checkbox-blank-circle-outline' }}</v-icon>
                  </v-btn>
                </template>
                <v-card max-width="300" class="pa-2">
                  <div class="d-flex flex-wrap gap-1 justify-center">
                    <v-btn
                      v-for="icon in $root.availableIcons"
                      :key="icon"
                      icon
                      size="small"
                      variant="text"
                      @click.stop="$root.updateTaskIcon(task, icon)"
                      :color="task.icon === icon ? 'primary' : ''"
                    >
                      <v-icon>{{ icon }}</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </v-menu>
            </div>
          </template>

          <div class="d-flex flex-column flex-grow-1 py-1 ms-1">
            <div class="d-flex align-center gap-golden mb-1">
              <v-list-item-title :class="{'text-decoration-line-through': task.done}" class="text-wrap font-weight-bold task-name flex-grow-1" style="min-width: 0;">
                {{ task.name }}
              </v-list-item-title>
              
              <div class="task-metrics-group ms-auto">
                <div class="d-flex align-center gap-1" title="Importance">
                  <v-icon size="14" :color="getPriorityColor(task.importance)" class="opacity-70">mdi-star</v-icon>
                  <v-progress-linear
                    :model-value="task.importance * 10"
                    :color="getPriorityColor(task.importance)"
                    height="4"
                    width="60"
                    rounded
                    class="flex-grow-0"
                    style="width: 60px;"
                  ></v-progress-linear>
                </div>
                <div class="d-flex align-center gap-1" title="Urgency">
                  <v-icon size="14" :color="getPriorityColor(task.urgency)" class="opacity-70">mdi-clock-fast</v-icon>
                  <v-progress-linear
                    :model-value="task.urgency * 10"
                    :color="getPriorityColor(task.urgency)"
                    height="4"
                    width="60"
                    rounded
                    class="flex-grow-0"
                    style="width: 60px;"
                  ></v-progress-linear>
                </div>
              </div>
            </div>

            <v-list-item-subtitle>
              <div class="d-flex align-center flex-wrap gap-golden">
                <v-chip v-if="task.category" size="x-small" color="purple" variant="flat" class="text-uppercase font-weight-bold">
                  {{ task.category }}
                </v-chip>
                
                <span v-if="task.due_date" class="text-caption text-orange d-flex align-center">
                  <v-icon size="14" class="me-1">mdi-calendar-clock</v-icon>
                  {{ task.due_date }}
                </span>

                <v-btn
                  v-if="task.link"
                  icon="mdi-link-variant"
                  size="x-small"
                  :href="task.link"
                  target="_blank"
                  color="primary"
                  variant="text"
                  title="Open Link"
                  @click.stop
                ></v-btn>
                
                <v-icon v-if="task.notes" size="14" color="grey" title="Has Notes">mdi-note-text-outline</v-icon>
              </div>
            </v-list-item-subtitle>
          </div>

          <template v-slot:append>
            <div class="d-flex align-center gap-golden">
              <div class="d-flex align-center">
                <!-- Nudge Outdent (Left) -->
                <v-btn
                  v-if="task.parent_id"
                  icon="mdi-format-indent-decrease"
                  variant="text"
                  size="x-small"
                  @click.stop="$root.outdentTask(task)"
                  title="Move to parent level"
                  class="nudge-btn"
                ></v-btn>

                <!-- Nudge Indent (Right) -->
                <v-btn
                  icon="mdi-format-indent-increase"
                  variant="text"
                  size="x-small"
                  @click.stop="$root.indentTask(task)"
                  title="Move under task above"
                  class="nudge-btn"
                ></v-btn>
              </div>

              <div class="d-flex align-center timer-group bg-grey-lighten-4 rounded-pill px-2 py-1">
                <span class="text-caption font-weight-bold px-2 timer-display">{{ $root.formatTime(task.active_timer_start ? $root.getElapsedTime(task.active_timer_start) : task.total_time_spent) }}</span>
                <v-btn
                  :icon="task.active_timer_start ? 'mdi-stop-circle' : 'mdi-play-circle'"
                  variant="text"
                  size="small"
                  :color="task.active_timer_start ? 'error' : 'success'"
                  @click.stop="$root.toggleTimer(task)"
                ></v-btn>
              </div>

              <v-menu location="bottom end">
                <template v-slot:activator="{ props }">
                  <v-btn
                    icon="mdi-dots-horizontal"
                    variant="text"
                    size="small"
                    v-bind="props"
                    @click.stop
                  ></v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item @click="$root.toggleNotSure(task)" prepend-icon="mdi-help-circle-outline">
                    <v-list-item-title>{{ task.status === 'Not Sure' ? 'Clear Not Sure' : 'Mark Not Sure' }}</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="$root.editTaskNotes(task)" prepend-icon="mdi-note-edit">
                    <v-list-item-title>Notes</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="$root.showAddSubtaskForm(task.id)" prepend-icon="mdi-plus">
                    <v-list-item-title>Add Subtask</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="depth === 0 ? $root.editTask(task) : $root.editSubtask(task)" prepend-icon="mdi-pencil">
                    <v-list-item-title>Edit</v-list-item-title>
                  </v-list-item>
                  <v-divider></v-divider>
                  <v-list-item @click="$root.deleteTask(task.id, task.name)" prepend-icon="mdi-delete" color="error">
                    <v-list-item-title>Delete</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>

              <v-checkbox 
                :model-value="task.done" 
                @change="$root.toggleTaskDone(task)"
                color="primary"
                hide-details
                @click.stop
                class="task-checkbox"
              ></v-checkbox>
            </div>
          </template>
        </v-list-item>

        <div v-if="hasChildren && isExpanded" class="subtasks-wrapper">
          <task-node
            v-for="child in children"
            :key="child.id"
            :task="child"
            :depth="depth + 1"
            :tasks="tasks"
            :expanded-tasks="expandedTasks"
            :show-completed-subtasks="showCompletedSubtasks"
          ></task-node>
        </div>
      </div>
    `,
    computed: {
      children() {
        return this.tasks.filter(t => Number(t.parent_id) === Number(this.task.id) && (!t.done || this.showCompletedSubtasks));
      },
      hasChildren() { return this.children.length > 0; },
      isExpanded() { return this.expandedTasks.has(this.task.id); },
      isHovered() { 
        return this.$root.hoveredTaskId === this.task.id || this.$root.hoveredTaskAncestors.has(this.task.id);
      }
    },
    methods: {
      onMouseEnter() { this.$root.hoveredTaskId = this.task.id; },
      onMouseLeave() { this.$root.hoveredTaskId = null; },
      getPriorityColor(value) {
        if (value >= 8) return 'error';
        if (value >= 6) return 'warning';
        if (value >= 4) return 'info';
        return 'success';
      }
    }
  });

  // Mount Vuetify to the app
  app.use(vuetify);
  
  // Mount the app to the DOM
  app.mount('#app');
  
  // window.app is already set in the mounted() hook above
});

// Now these exports will be valid since the variables are defined at the top level
export {
  chartVisualization,
  taskOperations,
  taskListManager
}; 
