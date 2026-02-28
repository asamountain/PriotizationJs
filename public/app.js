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
        currentView: 'tasks', // 'tasks' or 'analytics'
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
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null
        },
        showSubtaskModal: false,
        showWelcomeOverlay: false,
        parentId: null,
        showCompletedSubtasks: false,
        showNotSureTasks: localStorage.getItem('showNotSureTasks') === 'true',
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
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null
        },
        showTaskEditForm: false,
        editingTask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          enables: []
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
        leftPanelWidth: parseFloat(localStorage.getItem('leftPanelWidth')) || 55,
        isResizing: false,
        showCsvImportDialog: false,
        showQuickAddModal: false,
        influenceMode: localStorage.getItem('influenceMode') === 'true',
        quickAddTask: {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          notes: '',
          icon: 'mdi-checkbox-blank-circle-outline',
          enables: []
        },
        // Q1 Zoom Mode state
        isQ1ZoomMode: false,
        isChartZoomed: false,
        showRelationships: localStorage.getItem('showRelationships') === 'true',
        showChartSubtasks: localStorage.getItem('showSubtasks') !== 'false', // Default to true if not set
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
        availableColors: [
          { name: 'Red', value: '#FF5252' },
          { name: 'Pink', value: '#E91E63' },
          { name: 'Purple', value: '#9C27B0' },
          { name: 'Deep Purple', value: '#673AB7' },
          { name: 'Indigo', value: '#3F51B5' },
          { name: 'Blue', value: '#2196F3' },
          { name: 'Cyan', value: '#00BCD4' },
          { name: 'Teal', value: '#009688' },
          { name: 'Green', value: '#4CAF50' },
          { name: 'Light Green', value: '#8BC34A' },
          { name: 'Lime', value: '#CDDC39' },
          { name: 'Yellow', value: '#FFEB3B' },
          { name: 'Amber', value: '#FFC107' },
          { name: 'Orange', value: '#FF9800' },
          { name: 'Deep Orange', value: '#FF5722' },
          { name: 'Brown', value: '#795548' },
          { name: 'Grey', value: '#9E9E9E' },
          { name: 'Blue Grey', value: '#607D8B' }
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
        isSessionExpired: false,
        // Analytics data
        timeLogs: [], // Cache for time logs
        analytics: {
          productivityScore: 0,
          currentStreak: 0,
          thisWeekHours: 0,
          lastWeekHours: 0,
          weekChange: 0,
          totalPomodoros: 0,
          totalHours: 0,
          totalSessions: 0,
          avgSessionMins: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          completionRate: 0,
          dailyData: [],
          hourlyData: [],
          sessionDistribution: [],
          topTasks: [],
          pomodoroTrend: []
        },
        analyticsCharts: {}
      };
    },
    computed: {
      taskSortOptions() {
        const priorityTitle = this.influenceMode ? '🔥 Priority (Influence × Urgency)' : '🔥 Priority (Importance × Urgency)';
        return [
          { value: 'priority-high', title: `${priorityTitle} (High → Low)` },
          { value: 'priority-low', title: `${priorityTitle} (Low → High)` },
          { value: 'importance-high', title: '⭐ Importance (High → Low)' },
          { value: 'importance-low', title: '⭐ Importance (Low → High)' },
          { value: 'urgency-high', title: '⚡ Urgency (High → Low)' },
          { value: 'urgency-low', title: '⚡ Urgency (Low → High)' },
          { value: 'influence-high', title: '↗️ Influence (High → Low)' },
          { value: 'newest', title: '🆕 Newest First' },
          { value: 'oldest', title: '📅 Oldest First' },
          { value: 'due-date', title: '⏰ Due Date (Closest)' },
          { value: 'name-az', title: '🔤 Name (A → Z)' }
        ];
      },
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
      activeTasksForLinking() {
        // Get all active tasks that can be linked (for "enables" selection in Quick Add)
        return this.tasks
          .filter(task => !task.done)
          .map(task => ({
            id: task.id,
            name: task.name,
            importance: task.importance,
            urgency: task.urgency
          }));
      },
      activeTimerTask() {
        return this.tasks.find(t => t.active_timer_start);
      },
      activeTasksForEditing() {
        // Get all active tasks excluding the one being edited (for "enables" selection in Edit)
        const editingId = this.editingTask?.id;
        return this.tasks
          .filter(task => !task.done && task.id !== editingId)
          .map(task => ({
            id: task.id,
            name: task.name,
            importance: task.importance,
            urgency: task.urgency
          }));
      },
      sortedActiveTasks() {
        if (!this.activeTasks || this.activeTasks.length === 0) {
          return [];
        }

        let filteredTasks = [...this.activeTasks];

        // Filter out "Not Sure" tasks if hidden
        if (!this.showNotSureTasks) {
          filteredTasks = filteredTasks.filter(task => task.status !== 'Not Sure');
        }
        
        return this.sortTasks(filteredTasks);
      }
    },
    methods: {
      sortTasks(tasks) {
        if (!tasks || !Array.isArray(tasks)) return [];
        const sorted = [...tasks];
        
        switch (this.taskSortBy) {
          case 'priority-high':
            return sorted.sort((a, b) => {
              const valA = this.influenceMode ? (Number(a.leverage_score) || 1) : Number(a.importance);
              const valB = this.influenceMode ? (Number(b.leverage_score) || 1) : Number(b.importance);
              const priorityA = valA * (Number(a.urgency) || 5);
              const priorityB = valB * (Number(b.urgency) || 5);
              return priorityB - priorityA;
            });
          
          case 'priority-low':
            return sorted.sort((a, b) => {
              const valA = this.influenceMode ? (Number(a.leverage_score) || 1) : Number(a.importance);
              const valB = this.influenceMode ? (Number(b.leverage_score) || 1) : Number(b.importance);
              const priorityA = valA * (Number(a.urgency) || 5);
              const priorityB = valB * (Number(b.urgency) || 5);
              return priorityA - priorityB;
            });
          
          case 'importance-high':
            return sorted.sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0));
          
          case 'importance-low':
            return sorted.sort((a, b) => (Number(a.importance) || 0) - (Number(b.importance) || 0));
          
          case 'urgency-high':
            return sorted.sort((a, b) => (Number(b.urgency) || 0) - (Number(a.urgency) || 0));
          
          case 'urgency-low':
            return sorted.sort((a, b) => (Number(a.urgency) || 0) - (Number(b.urgency) || 0));

          case 'influence-high':
            return sorted.sort((a, b) => (parseFloat(b.leverage_score) || 0) - (parseFloat(a.leverage_score) || 0));
          
          case 'newest':
            return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          case 'oldest':
            return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          
          case 'due-date':
            return sorted.sort((a, b) => {
              if (!a.due_date && !b.due_date) return 0;
              if (!a.due_date) return 1;
              if (!b.due_date) return -1;
              return new Date(a.due_date) - new Date(b.due_date);
            });
          
          case 'name-az':
            return sorted.sort((a, b) => a.name.localeCompare(b.name));
          
          default:
            return sorted;
        }
      },
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
        // If the task has an active timer, stop it before marking as done
        if (!task.done && task.active_timer_start) {
          this.socket.emit('stopTimer', task.id);
          this.showNotification(`Timer stopped for: ${task.name}`, 'info');
        }
        taskOperations.toggleDone(task.id);
      },

      startWorkOnTask(task) {
        // Start timer if not already running
        if (!task.active_timer_start) {
          // Stop other running timers for focus
          this.tasks.forEach(t => {
            if (t.active_timer_start && t.id !== task.id) {
              this.socket.emit('stopTimer', t.id);
            }
          });
          
          this.socket.emit('startTimer', task.id);
          this.showNotification(`Now working on: ${task.name}`, 'success');
        }
        
        // Open link if it exists
        if (task.link) {
          window.open(task.link, '_blank');
        }
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
          importance: 5.0,
          urgency: 5.0,
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
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null
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
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null
        };
      },
      
      cancelEdit() {
        this.showEditForm = false;
      },
      
      editTask(task) {
        this.editingTask = { ...task, enables: [] };
        this.showTaskEditForm = true;

        // Load current relationships for this task
        this.socket.emit('getTaskRelationships', task.id);
        this.socket.once('taskRelationships', (data) => {
          if (data.taskId === task.id && data.enables) {
            this.editingTask.enables = data.enables.map(t => t.id);
          }
        });
      },
      
      saveTaskEdit() {
        if (!this.editingTask.name) return;

        taskOperations.editTask(this.editingTask);

        // Update relationships - emit event to update enables
        if (this.editingTask.enables && this.editingTask.enables.length >= 0) {
          this.socket.emit('updateTaskRelationships', {
            taskId: this.editingTask.id,
            enables: this.editingTask.enables
          });
        }

        this.showTaskEditForm = false;
        this.editingTask = {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null,
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          enables: []
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
        localStorage.setItem('showNotSureTasks', this.showNotSureTasks);
        
        // Synchronize with chart
        if (chartVisualization) {
          chartVisualization.showNotSureTasks = this.showNotSureTasks;
          chartVisualization.renderChart(this.tasks);
        }

        const msg = this.showNotSureTasks ? 'Showing "Not Sure" tasks' : 'Hiding "Not Sure" tasks';
        this.showNotification(msg, 'info');
      },

      toggleInfluenceMode() {
        this.influenceMode = !this.influenceMode;
        localStorage.setItem('influenceMode', this.influenceMode);
        const msg = this.influenceMode ? 'Influence Mode (Leverage)' : 'Importance Mode (Standard)';
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
        const rawActive = tasks.filter(task => {
          const isRoot = !task.parent_id || !parentExists(task.parent_id);
          const isNotSureHidden = !this.showNotSureTasks && task.status === 'Not Sure';
          return !task.done && isRoot && !isNotSureHidden;
        });
        const rawCompleted = tasks.filter(task => task.done && (!task.parent_id || !parentExists(task.parent_id)));
        
        console.log('Filtered Active (root/orphaned):', rawActive.length);
        console.log('Filtered Completed (root/orphaned):', rawCompleted.length);

        this.activeTasks = rawActive;
        this.completedTasks = rawCompleted;
        
        // DEBUG: Log top leverage scores
        const topLeverage = [...rawActive].sort((a, b) => (b.leverage_score || 0) - (a.leverage_score || 0)).slice(0, 3);
        console.log('Top tasks by leverage:', topLeverage.map(t => `${t.name}: ${t.leverage_score}`));

        // Update basic analytics stats instantly (don't wait for fetch)
        if (this.timeLogs && this.timeLogs.length > 0) {
          this.processAnalyticsData({ tasks: this.tasks, timeLogs: this.timeLogs });
        } else if (this.currentView === 'analytics') {
          // If we're on the page but have no logs, load them
          this.loadAnalytics();
        } else {
          // Just update task-based counts
          this.analytics.tasksCompleted = tasks.filter(t => t.done).length;
          this.analytics.tasksActive = tasks.filter(t => !t.done).length;
          this.analytics.completionRate = tasks.length > 0
            ? Math.round(this.analytics.tasksCompleted / tasks.length * 100)
            : 0;
        }

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

      closeNotesDialog() {
        this.showNotesDialog = false;
        this.editingNotes = '';
        this.currentTask = null;
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
        this.quickAddTask.enables = [];
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
          notes: this.quickAddTask.notes || null,
          icon: this.quickAddTask.icon || 'mdi-checkbox-blank-circle-outline',
          color: this.quickAddTask.color || null
        };

        const enables = this.quickAddTask.enables || [];

        // If there are relationships, use the new socket event
        if (enables.length > 0) {
          this.socket.emit('addTaskWithRelationships', { task: taskData, enables });
        } else {
          // Use taskOperations for simple task addition
          taskOperations.addTask(taskData);
        }
        this.showNotification(`Added: ${taskData.name}`, 'success');

        // Close modal and reset
        this.showQuickAddModal = false;
        this.quickAddTask = {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          notes: '',
          icon: 'mdi-checkbox-blank-circle-outline',
          color: null,
          enables: []
        };
      },

      toggleQ1ZoomMode() {
        if (this.isChartZoomed || this.isQ1ZoomMode) {
          // Reset zoom
          this.isQ1ZoomMode = false;
          this.isChartZoomed = false;
          if (chartVisualization) {
            chartVisualization.resetZoom();
          }
          this.showNotification('Zoom reset to normal view', 'info');
        } else {
          // Enable Q1 zoom
          this.isQ1ZoomMode = true;
          this.isChartZoomed = true;
          if (chartVisualization) {
            chartVisualization.toggleQ1ZoomMode();
          }
          this.showNotification('Q1 Zoom Mode enabled - showing tasks 5-10', 'info');
        }
      },

      zoomIn() {
        if (chartVisualization) {
          chartVisualization.zoomIn();
        }
      },

      zoomOut() {
        if (chartVisualization) {
          chartVisualization.zoomOut();
        }
      },

      toggleRelationships() {
        this.showRelationships = !this.showRelationships;
        localStorage.setItem('showRelationships', this.showRelationships);
        
        if (chartVisualization) {
          chartVisualization.showRelationships = this.showRelationships;
          chartVisualization.renderChart(this.tasks);
        }
        
        const msg = this.showRelationships ? 'Task relationships shown' : 'Task relationships hidden';
        this.showNotification(msg, 'info');
      },

      toggleChartSubtasks() {
        this.showChartSubtasks = !this.showChartSubtasks;
        localStorage.setItem('showSubtasks', this.showChartSubtasks);
        
        if (chartVisualization) {
          chartVisualization.showSubtasks = this.showChartSubtasks;
          chartVisualization.renderChart(this.tasks);
        }
        
        const msg = this.showChartSubtasks ? 'Subtasks shown on chart' : 'Subtasks hidden from chart';
        this.showNotification(msg, 'info');
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
          const width = ((e.clientX - rect.left) / (rect.width || 1)) * 100;
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
        // Emit specific event for icon update
        this.socket.emit('updateTaskIcon', { taskId: task.id, icon: icon });
        
        // Immediate local update for UI responsiveness
        task.icon = icon;
        this.showNotification('Icon updated', 'success');
      },

      updateTaskColor(task, color) {
        // Emit specific event for color update
        this.socket.emit('updateTaskColor', { taskId: task.id, color: color });
        
        // Immediate local update for UI responsiveness
        task.color = color;
        this.showNotification('Color updated', 'success');
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

      checkFirstVisit() {
        const hasVisited = localStorage.getItem('hasVisitedPriorityManager');
        if (!hasVisited) {
          this.showWelcomeOverlay = true;
        }
      },

      dismissWelcome() {
        this.showWelcomeOverlay = false;
        localStorage.setItem('hasVisitedPriorityManager', 'true');
        
        // If they have no tasks, offer to create demo tasks
        if (this.tasks.length === 0) {
          this.createDemoTasks();
        }
      },

      createDemoTasks() {
        const demoTasks = [
          { name: '🚀 Drag me on the chart to prioritize', importance: 8, urgency: 8, icon: 'mdi-rocket', notes: 'This is an Important & Urgent task (Q1).' },
          { name: '🍅 Start a Pomodoro on me', importance: 9, urgency: 4, icon: 'mdi-timer', notes: 'Click the play button to start focus time.' },
          { name: '🔗 Double-click me to add subtasks', importance: 5, urgency: 3, icon: 'mdi-sitemap', notes: 'Break big goals into smaller steps.' }
        ];

        demoTasks.forEach(task => {
          taskOperations.addTask(task);
        });

        this.showNotification('Demo tasks created! Try dragging them.', 'success');
      },

      // Analytics Methods
      async loadAnalytics() {
        try {
          // If we already have logs, we can render instantly
          if (this.timeLogs && this.timeLogs.length > 0) {
            this.$nextTick(() => this.renderAnalyticsCharts());
            // We still fetch in background to stay updated, but user doesn't wait
          }

          console.log('Fetching fresh analytics data...');
          const response = await fetch('/api/analytics');
          if (!response.ok) throw new Error('Failed to fetch analytics');

          const data = await response.json();
          this.timeLogs = data.timeLogs || [];
          
          this.processAnalyticsData(data);
          this.$nextTick(() => this.renderAnalyticsCharts());
        } catch (error) {
          console.error('Analytics error:', error);
          if (!this.timeLogs.length) {
            this.showNotification('Failed to load analytics', 'error');
          }
        }
      },

      processAnalyticsData(data) {
        const { tasks, timeLogs } = data;
        if (timeLogs) this.timeLogs = timeLogs; // Update cache
        const now = new Date();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

        // Total hours
        const totalSeconds = timeLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
        this.analytics.totalHours = (totalSeconds / 3600).toFixed(1);

        // Total sessions and avg
        this.analytics.totalSessions = timeLogs.length;
        this.analytics.avgSessionMins = timeLogs.length > 0
          ? Math.round(totalSeconds / timeLogs.length / 60)
          : 0;

        // Total pomodoros (25+ min sessions)
        this.analytics.totalPomodoros = timeLogs.filter(log => log.duration >= 1500).length;

        // Tasks stats
        this.analytics.tasksCompleted = tasks.filter(t => t.done).length;
        this.analytics.tasksActive = tasks.filter(t => !t.done).length;
        this.analytics.completionRate = tasks.length > 0
          ? Math.round(this.analytics.tasksCompleted / tasks.length * 100)
          : 0;

        // This week vs last week
        const thisWeekLogs = timeLogs.filter(log => new Date(log.start_time) >= sevenDaysAgo);
        const lastWeekLogs = timeLogs.filter(log => {
          const d = new Date(log.start_time);
          return d >= fourteenDaysAgo && d < sevenDaysAgo;
        });

        const thisWeekSecs = thisWeekLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
        const lastWeekSecs = lastWeekLogs.reduce((sum, log) => sum + (log.duration || 0), 0);

        this.analytics.thisWeekHours = (thisWeekSecs / 3600).toFixed(1);
        this.analytics.lastWeekHours = (lastWeekSecs / 3600).toFixed(1);
        this.analytics.weekChange = lastWeekSecs > 0
          ? Math.round((thisWeekSecs - lastWeekSecs) / lastWeekSecs * 100)
          : (thisWeekSecs > 0 ? 100 : 0);

        // Productivity Score (time on importance >= 7 tasks)
        const highImpTimeLogs = thisWeekLogs.filter(log => {
          const task = tasks.find(t => t.id === log.task_id);
          return task && task.importance >= 7;
        });
        const highImpSeconds = highImpTimeLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
        this.analytics.productivityScore = thisWeekSecs > 0
          ? Math.round(highImpSeconds / thisWeekSecs * 100)
          : 0;

        // Focus Streak (consecutive days with sessions)
        const daysWithSessions = new Set(
          timeLogs.map(log => new Date(log.start_time).toISOString().split('T')[0])
        );
        const sortedDays = Array.from(daysWithSessions).sort().reverse();
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (sortedDays[0] === today || sortedDays[0] === yesterday) {
          streak = 1;
          for (let i = 1; i < sortedDays.length; i++) {
            const prevDate = new Date(sortedDays[i - 1]);
            const currDate = new Date(sortedDays[i]);
            const diffDays = (prevDate - currDate) / (24 * 60 * 60 * 1000);
            if (diffDays === 1) {
              streak++;
            } else {
              break;
            }
          }
        }
        this.analytics.currentStreak = streak;

        // Daily data for chart (last 30 days)
        const dailyMap = {};
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now - i * 24 * 60 * 60 * 1000);
          const key = d.toISOString().split('T')[0];
          dailyMap[key] = 0;
        }
        timeLogs.forEach(log => {
          const key = new Date(log.start_time).toISOString().split('T')[0];
          if (dailyMap.hasOwnProperty(key)) {
            dailyMap[key] += (log.duration || 0) / 3600;
          }
        });
        this.analytics.dailyData = Object.entries(dailyMap).map(([date, hours]) => ({
          date,
          hours: parseFloat(hours.toFixed(2))
        }));

        // Hourly data
        const hourlyMap = Array(24).fill(0);
        timeLogs.forEach(log => {
          const hour = new Date(log.start_time).getHours();
          hourlyMap[hour] += (log.duration || 0) / 3600;
        });
        this.analytics.hourlyData = hourlyMap.map((hours, hour) => ({
          hour: `${hour}:00`,
          hours: parseFloat(hours.toFixed(2))
        }));

        // Session distribution
        const distMap = { '< 5 min': 0, '5-15 min': 0, '15-25 min': 0, '25+ min': 0 };
        timeLogs.forEach(log => {
          const mins = (log.duration || 0) / 60;
          if (mins < 5) distMap['< 5 min']++;
          else if (mins < 15) distMap['5-15 min']++;
          else if (mins < 25) distMap['15-25 min']++;
          else distMap['25+ min']++;
        });
        this.analytics.sessionDistribution = Object.entries(distMap).map(([name, value]) => ({
          name, value
        }));

        // Top tasks by time
        const taskTimeMap = {};
        timeLogs.forEach(log => {
          const task = tasks.find(t => t.id === log.task_id);
          if (task) {
            taskTimeMap[task.name] = (taskTimeMap[task.name] || 0) + (log.duration || 0);
          }
        });
        this.analytics.topTasks = Object.entries(taskTimeMap)
          .map(([name, seconds]) => ({ name, hours: parseFloat((seconds / 3600).toFixed(2)) }))
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 10);

        // Pomodoro trend (last 30 days)
        const pomoMap = {};
        for (let i = 29; i >= 0; i--) {
          const d = new Date(now - i * 24 * 60 * 60 * 1000);
          const key = d.toISOString().split('T')[0];
          pomoMap[key] = 0;
        }
        timeLogs.filter(log => log.duration >= 1500).forEach(log => {
          const key = new Date(log.start_time).toISOString().split('T')[0];
          if (pomoMap.hasOwnProperty(key)) {
            pomoMap[key]++;
          }
        });
        this.analytics.pomodoroTrend = Object.entries(pomoMap).map(([date, count]) => ({
          date, count
        }));
      },

      renderAnalyticsCharts() {
        const isDark = this.isDarkTheme;
        const textColor = isDark ? '#ccc' : '#333';
        const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

        // Destroy existing charts
        Object.values(this.analyticsCharts).forEach(chart => chart?.dispose());

        // Daily Focus Chart
        const dailyEl = document.getElementById('dailyFocusChart');
        if (dailyEl) {
          const chart = echarts.init(dailyEl, isDark ? 'dark' : null);
          chart.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: 50, right: 20, bottom: 40, top: 20 },
            xAxis: {
              type: 'category',
              data: this.analytics.dailyData.map(d => d.date.slice(5)),
              axisLabel: { color: textColor, rotate: 45 }
            },
            yAxis: {
              type: 'value',
              name: 'Hours',
              axisLabel: { color: textColor },
              splitLine: { lineStyle: { color: gridColor } }
            },
            series: [{
              data: this.analytics.dailyData.map(d => d.hours),
              type: 'bar',
              itemStyle: { color: '#4CAF50', borderRadius: [4, 4, 0, 0] },
              emphasis: { itemStyle: { color: '#66BB6A' } }
            }]
          });
          this.analyticsCharts.daily = chart;
        }

        // Session Distribution Pie
        const distEl = document.getElementById('sessionDistChart');
        if (distEl) {
          const chart = echarts.init(distEl, isDark ? 'dark' : null);
          chart.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { bottom: 0, textStyle: { color: textColor } },
            series: [{
              type: 'pie',
              radius: ['40%', '70%'],
              avoidLabelOverlap: false,
              itemStyle: { borderRadius: 8, borderColor: isDark ? '#1e1e1e' : '#fff', borderWidth: 2 },
              label: { show: false },
              emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
              data: this.analytics.sessionDistribution.map((d, i) => ({
                ...d,
                itemStyle: { color: ['#f44336', '#ff9800', '#2196f3', '#4caf50'][i] }
              }))
            }]
          });
          this.analyticsCharts.dist = chart;
        }

        // Hourly Chart
        const hourlyEl = document.getElementById('hourlyChart');
        if (hourlyEl) {
          const chart = echarts.init(hourlyEl, isDark ? 'dark' : null);
          chart.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: 50, right: 20, bottom: 30, top: 20 },
            xAxis: {
              type: 'category',
              data: this.analytics.hourlyData.map(d => d.hour),
              axisLabel: { color: textColor, interval: 2 }
            },
            yAxis: {
              type: 'value',
              name: 'Hours',
              axisLabel: { color: textColor },
              splitLine: { lineStyle: { color: gridColor } }
            },
            series: [{
              data: this.analytics.hourlyData.map(d => d.hours),
              type: 'bar',
              itemStyle: { color: '#2196F3', borderRadius: [4, 4, 0, 0] }
            }]
          });
          this.analyticsCharts.hourly = chart;
        }

        // Pomodoro Trend
        const pomoEl = document.getElementById('pomodoroChart');
        if (pomoEl) {
          const chart = echarts.init(pomoEl, isDark ? 'dark' : null);
          chart.setOption({
            tooltip: { trigger: 'axis' },
            grid: { left: 50, right: 20, bottom: 40, top: 20 },
            xAxis: {
              type: 'category',
              data: this.analytics.pomodoroTrend.map(d => d.date.slice(5)),
              axisLabel: { color: textColor, rotate: 45 }
            },
            yAxis: {
              type: 'value',
              name: 'Pomodoros',
              minInterval: 1,
              axisLabel: { color: textColor },
              splitLine: { lineStyle: { color: gridColor } }
            },
            series: [{
              data: this.analytics.pomodoroTrend.map(d => d.count),
              type: 'line',
              smooth: true,
              areaStyle: { color: 'rgba(255, 152, 0, 0.3)' },
              lineStyle: { color: '#FF9800', width: 2 },
              itemStyle: { color: '#FF9800' }
            }]
          });
          this.analyticsCharts.pomo = chart;
        }

        // Top Tasks Chart
        const topEl = document.getElementById('topTasksChart');
        if (topEl) {
          const chart = echarts.init(topEl, isDark ? 'dark' : null);
          chart.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: 150, right: 40, bottom: 20, top: 20 },
            xAxis: {
              type: 'value',
              name: 'Hours',
              axisLabel: { color: textColor },
              splitLine: { lineStyle: { color: gridColor } }
            },
            yAxis: {
              type: 'category',
              data: this.analytics.topTasks.map(d => d.name).reverse(),
              axisLabel: {
                color: textColor,
                width: 130,
                overflow: 'truncate',
                ellipsis: '...'
              }
            },
            series: [{
              data: this.analytics.topTasks.map(d => d.hours).reverse(),
              type: 'bar',
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: '#667eea' },
                  { offset: 1, color: '#764ba2' }
                ]),
                borderRadius: [0, 4, 4, 0]
              }
            }]
          });
          this.analyticsCharts.top = chart;
        }

        // Handle resize
        window.addEventListener('resize', () => {
          Object.values(this.analyticsCharts).forEach(chart => chart?.resize());
        });
      },
    },
    watch: {
      taskSortBy(newValue) {
        // Save sort preference to localStorage
        localStorage.setItem('taskSortBy', newValue);
      },
      currentView(newValue) {
        if (newValue === 'analytics') {
          this.loadAnalytics();
        }
      }
    },
    provide() {
      return {
        openQuickAddModal: this.openQuickAddModal,
        isQ1ZoomMode: () => this.isQ1ZoomMode
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
        
        // Hide splash screen after initialization
        const splash = document.getElementById('splash-screen');
        if (splash) {
          splash.style.opacity = '0';
          setTimeout(() => {
            splash.remove();
          }, 400);
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
        console.log('Socket connected, checking auth');
        // If we have a user, authenticate. authenticate will trigger initialData fetch.
        // If no user, request initialData (public tasks).
        if (this.user && this.user.id) {
          this.authenticateSocket();
        } else {
          this.socket.emit('requestInitialData');
        }
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

      this.socket.on('error', ({ message }) => {
        this.showNotification(message || "An error occurred", "error");
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
      
      // Check if first time user
      this.checkFirstVisit();
      
      // Pre-load analytics data in background
      this.loadAnalytics();
      
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
    data() {
      return {
        longPressTimer: null,
        longPressMenu: false,
        menuX: 0,
        menuY: 0,
        isPressing: false
      };
    },
    template: `
      <div 
        :class="['task-node-container', isHovered ? 'branch-hover' : '', isPressing ? 'task-pressing' : '']" 
        @mouseenter.stop="onMouseEnter"
        @mouseleave.stop="onMouseLeave"
      >
        <v-list-item
          :value="task.id"
          @click="$root.selectTask(task)"
          @dblclick="$root.showAddSubtaskForm(task.id)"
          :data-task-id="task.id" 
          :class="['task-item', depth > 0 ? 'subtask' : '', task.active_timer_start ? 'timer-active' : '']"
          :style="{ 
            cursor: 'grab', 
            position: 'relative',
            backgroundColor: task.color ? (task.color + '15') : '',
            borderLeft: task.color ? ('4px solid ' + task.color) : ''
          }"
          draggable="true"
          @dragstart="$root.handleDragStart(task, $event)"
          @dragover="$root.handleDragOver"
          @dragleave="$root.handleDragLeave"
          @drop.stop="$root.handleDropOnTask(task, $event)"
          @dragend="$root.handleDragEnd"
          @mousedown="startPress"
          @mouseup="endPress"
          @mouseleave="endPress"
          @touchstart="startPress"
          @touchend="endPress"
        >
          <!-- Hidden anchor for the menu positioning -->
          <div 
            ref="menuAnchor" 
            :style="{ position: 'fixed', left: menuX + 'px', top: menuY + 'px', width: '1px', height: '1px', pointerEvents: 'none' }"
          ></div>

          <!-- Mode Selection Menu (Comprehensive Command Menu) -->
          <v-menu
            v-model="longPressMenu"
            :activator="$refs.menuAnchor"
            offset="10"
            transition="scale-transition"
          >
            <v-list density="compact" elevation="15" rounded="xl" min-width="220" class="py-2">
              <v-list-subheader class="text-uppercase font-weight-bold text-xxs px-4">Mode / Status</v-list-subheader>
              
              <!-- Icon Picker Sub-menu -->
              <v-menu location="end top" open-on-hover offset="5">
                <template v-slot:activator="{ props }">
                  <v-list-item v-bind="props" class="pe-2">
                    <template v-slot:prepend>
                      <v-icon :color="getPriorityColor(task.importance)" size="small">
                        {{ task.icon || 'mdi-circle-outline' }}
                      </v-icon>
                    </template>
                    <v-list-item-title>Change Icon</v-list-item-title>
                    <template v-slot:append><v-icon size="x-small">mdi-chevron-right</v-icon></template>
                  </v-list-item>
                </template>
                <v-card max-width="240" class="pa-2" elevation="10" rounded="lg">
                  <div class="d-flex flex-wrap gap-1 justify-center">
                    <v-btn
                      v-for="icon in $root.availableIcons"
                      :key="icon"
                      icon
                      size="x-small"
                      variant="text"
                      @click.stop="$root.updateTaskIcon(task, icon)"
                      :color="task.icon === icon ? 'primary' : ''"
                      :title="icon.replace('mdi-', '')"
                    >
                      <v-icon size="18">{{ icon }}</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </v-menu>

              <!-- Color Picker Sub-menu -->
              <v-menu location="end top" open-on-hover offset="5">
                <template v-slot:activator="{ props }">
                  <v-list-item v-bind="props" class="pe-2">
                    <template v-slot:prepend>
                      <v-icon :color="task.color || 'grey'" size="small">
                        mdi-palette
                      </v-icon>
                    </template>
                    <v-list-item-title>Change Color</v-list-item-title>
                    <template v-slot:append><v-icon size="x-small">mdi-chevron-right</v-icon></template>
                  </v-list-item>
                </template>
                <v-card max-width="240" class="pa-2" elevation="10" rounded="lg">
                  <div class="d-flex flex-wrap gap-1 justify-center">
                    <v-btn
                      v-for="color in $root.availableColors"
                      :key="color.value"
                      icon
                      size="x-small"
                      @click.stop="$root.updateTaskColor(task, color.value)"
                      :color="color.value"
                      :title="color.name"
                      variant="flat"
                    >
                    </v-btn>
                    <v-btn
                      icon
                      size="x-small"
                      @click.stop="$root.updateTaskColor(task, null)"
                      title="Clear Color"
                      variant="outlined"
                    >
                      <v-icon size="14">mdi-close</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </v-menu>

              <v-list-item @click="$root.toggleNotSure(task)" :active="task.status === 'Not Sure'" :color="task.status === 'Not Sure' ? 'warning' : ''">
                <template v-slot:prepend><v-icon :color="task.status === 'Not Sure' ? 'warning' : 'grey'" size="small">mdi-help-circle</v-icon></template>
                <v-list-item-title>Not Sure Mode</v-list-item-title>
              </v-list-item>

              <v-divider class="my-1"></v-divider>
              <v-list-subheader class="text-uppercase font-weight-bold text-xxs px-4">Actions</v-list-subheader>
              
              <v-list-item @click="$root.toggleTimer(task)">
                <template v-slot:prepend>
                  <v-icon :color="task.active_timer_start ? 'error' : 'success'" size="small">
                    {{ task.active_timer_start ? 'mdi-stop-circle' : 'mdi-play-circle' }}
                  </v-icon>
                </template>
                <v-list-item-title>{{ task.active_timer_start ? 'Stop Timer' : 'Start Timer' }}</v-list-item-title>
              </v-list-item>

              <v-list-item @click="$root.showAddSubtaskForm(task.id)">
                <template v-slot:prepend><v-icon size="small">mdi-plus</v-icon></template>
                <v-list-item-title>Add Subtask</v-list-item-title>
              </v-list-item>

              <v-list-item @click="depth === 0 ? $root.editTask(task) : $root.editSubtask(task)">
                <template v-slot:prepend><v-icon size="small">mdi-pencil</v-icon></template>
                <v-list-item-title>Edit Details</v-list-item-title>
              </v-list-item>

              <v-list-item @click="$root.editTaskNotes(task)">
                <template v-slot:prepend><v-icon size="small">mdi-note-edit</v-icon></template>
                <v-list-item-title>Notes</v-list-item-title>
              </v-list-item>

              <v-divider class="my-1"></v-divider>
              <v-list-subheader class="text-uppercase font-weight-bold text-xxs px-4">Hierarchy</v-list-subheader>
              
              <v-list-item @click="$root.indentTask(task)">
                <template v-slot:prepend><v-icon size="small">mdi-format-indent-increase</v-icon></template>
                <v-list-item-title>Move In (Indent)</v-list-item-title>
              </v-list-item>

              <v-list-item v-if="task.parent_id" @click="$root.outdentTask(task)">
                <template v-slot:prepend><v-icon size="small">mdi-format-indent-decrease</v-icon></template>
                <v-list-item-title>Move Out (Outdent)</v-list-item-title>
              </v-list-item>

              <v-divider class="my-1"></v-divider>
              <v-list-subheader class="text-uppercase font-weight-bold text-xxs px-4">Relationships</v-list-subheader>
              
              <v-list-item @click="$root.editTask(task)">
                <template v-slot:prepend><v-icon color="purple" size="small">mdi-chart-network</v-icon></template>
                <v-list-item-title>Edit Influences</v-list-item-title>
              </v-list-item>

              <v-divider class="my-1"></v-divider>
              <v-list-item @click="$root.deleteTask(task.id, task.name)" class="text-error">
                <template v-slot:prepend><v-icon color="error" size="small">mdi-delete</v-icon></template>
                <v-list-item-title class="font-weight-bold">Delete Task</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <template v-slot:prepend>
            <div class="d-flex align-center toggle-junction gap-2 me-3">
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
              
              <v-icon 
                size="20" 
                :color="task.done ? 'grey' : (task.color || getPriorityColor(task.importance))"
                class="opacity-70"
              >
                {{ task.icon || (task.status === 'Not Sure' ? 'mdi-help-circle' : 'mdi-checkbox-blank-circle-outline') }}
              </v-icon>
            </div>
          </template>

          <div class="d-flex flex-column flex-grow-1 py-1 ms-1">
            <div class="d-flex align-center gap-golden">
              <v-list-item-title :class="{'text-decoration-line-through opacity-50': task.done}" class="text-wrap font-weight-bold task-name flex-grow-1">
                {{ task.name }}
              </v-list-item-title>
              
              <div v-if="task.active_timer_start" class="text-caption font-weight-bold text-error ms-2">
                {{ $root.formatTime($root.getElapsedTime(task.active_timer_start)) }}
              </div>
            </div>

            <v-list-item-subtitle v-if="task.due_date || task.link || task.notes || task.leverage_score > 0">
              <div class="d-flex align-center flex-wrap gap-2 mt-1">
                <v-chip v-if="task.leverage_score > 0" size="x-small" color="purple" variant="flat">
                  <v-icon start size="10">mdi-arrow-up-bold</v-icon>{{ Number(task.leverage_score).toFixed(1) }}
                </v-chip>
                <v-chip v-if="task.category" size="x-small" color="grey" variant="outlined">{{ task.category }}</v-chip>
                <span v-if="task.due_date" class="text-xxs text-orange">
                  <v-icon size="10">mdi-calendar</v-icon> {{ task.due_date }}
                </span>
                <a v-if="task.link" href="javascript:void(0)" @click.stop="$root.startWorkOnTask(task)" class="text-decoration-none">
                  <v-icon size="10" color="primary" title="Start work and open link">mdi-link-variant</v-icon>
                </a>
                <v-icon v-if="task.notes" size="10" color="grey">mdi-note-text-outline</v-icon>
              </div>
            </v-list-item-subtitle>
          </div>

          <template v-slot:append>
            <div class="d-flex align-center gap-2">
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
        const filtered = this.tasks.filter(t => Number(t.parent_id) === Number(this.task.id) && (!t.done || this.showCompletedSubtasks));
        return this.$root.sortTasks(filtered);
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
      },
      startPress(e) {
        // Only trigger on left click
        if (e.type === 'mousedown' && e.button !== 0) return;
        
        this.isPressing = true;
        this.longPressTimer = setTimeout(() => {
          this.showModeMenu(e);
        }, 500); // 0.5 seconds
      },
      endPress() {
        this.isPressing = false;
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      },
      showModeMenu(e) {
        this.isPressing = false;
        
        // Handle both mouse and touch events
        const event = e.touches ? e.touches[0] : e;
        this.menuX = event.clientX;
        this.menuY = event.clientY;
        
        this.longPressMenu = true;
        
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
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
