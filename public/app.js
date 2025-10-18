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
            primary: '#1976D2',
            secondary: '#9C27B0',
            accent: '#FF4081',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3',
            success: '#4CAF50',
          },
        },
        dark: {
          colors: {
            primary: '#2196F3',
            secondary: '#BB86FC',
            accent: '#03DAC6',
            error: '#CF6679',
            warning: '#FFB74D',
            info: '#64B5F6',
            success: '#81C784',
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
          due_date: null
        },
        showTaskEditForm: false,
        editingTask: {
          id: null,
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          due_date: null
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
        showAddTaskPanel: localStorage.getItem('showAddTaskPanel') !== 'false',
        showCsvImportPanel: localStorage.getItem('showCsvImportPanel') !== 'false',
        showQuickAddModal: false,
        quickAddTask: {
          name: '',
          importance: 5,
          urgency: 5,
          link: '',
          notes: ''
        },
      };
    },
    computed: {
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
        
        const tasks = [...this.activeTasks];
        
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
        const subtasks = this.tasks.filter(task => task.parent_id === taskId);
        
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
        this.possibleParents = this.activeTasks;
        this.showEditForm = true;
      },
      
      saveSubtaskEdit() {
        if (!this.editingSubtask.name) return;
        
        console.log("UI: Saving subtask edit:");
        console.log("UI: Subtask ID:", this.editingSubtask.id);
        console.log("UI: Subtask link before saving:", this.editingSubtask.link);
        
        // Ensure link is properly formatted
        if (this.editingSubtask.link && typeof this.editingSubtask.link === 'string') {
          // Add http:// prefix if missing
          if (!/^https?:\/\//i.test(this.editingSubtask.link)) {
            this.editingSubtask.link = 'http://' + this.editingSubtask.link;
            console.log("UI: Added http:// prefix to link:", this.editingSubtask.link);
          }
        }
        
        console.log("UI: Final subtask link value being sent:", this.editingSubtask.link);
        taskOperations.updateSubtask(this.editingSubtask);
        
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
      
      updateTasks(tasks) {
        this.tasks = tasks;
        this.activeTasks = tasks.filter(task => !task.done && !task.parent_id);
        this.completedTasks = tasks.filter(task => task.done && !task.parent_id);
        
        // Debug: Log information about tasks with links
        console.log('Tasks with links:');
        tasks.forEach(task => {
          if (task.link) {
            console.log(`Task ${task.id} (${task.name}): ${task.link}`);
          }
        });
        
        // Debug: Count of subtasks with links
        const subtasks = tasks.filter(task => task.parent_id);
        const subtasksWithLinks = subtasks.filter(task => task.link);
        console.log(`Subtasks with links: ${subtasksWithLinks.length} out of ${subtasks.length}`);
        if (subtasksWithLinks.length > 0) {
          console.log('Subtasks with links:', subtasksWithLinks);
        }
        
        // Re-render the chart with updated tasks
        console.log('Updating chart with', tasks.length, 'tasks');
        if (chartVisualization && typeof chartVisualization.renderChart === 'function') {
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
          console.log('Formatting link:', url); // Debug logging
          const urlObj = new URL(url);
          // Show domain and first part of path if exists
          let displayText = urlObj.hostname;
          if (urlObj.pathname && urlObj.pathname !== '/') {
            // Add first part of path if not too long
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
          console.warn('Error formatting link:', e, url);
          // If not a valid URL, return first part of string with reasonable length
          return url.length > 20 ? url.substring(0, 18) + '...' : url;
        }
      },
      
      // Debug helper for links
      debugLinkInfo(subtask) {
        console.log('Subtask link info:', {
          id: subtask.id,
          name: subtask.name,
          hasLink: !!subtask.link,
          linkValue: subtask.link,
          linkType: typeof subtask.link,
          displayValue: this.formatLinkDisplay(subtask.link)
        });
        return !!subtask.link;
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
        console.log("Opening notes for task:", task.id, task.name);
        
        // Force fetch the latest task data from the server to ensure we have latest notes
        const socket = this.socket || window.socket;
        if (socket) {
          socket.emit('getTaskDetails', { taskId: task.id });
          
          // Set up a one-time listener for the response
          socket.once('taskDetails', (taskData) => {
            console.log("Received task details:", taskData);
            if (taskData && taskData.id === task.id) {
              this.currentTask = taskData;
              this.editingNotes = taskData.notes || '';
              this.noteTaskId = task.id;
              
              console.log("Setting notes to:", this.editingNotes);
              this.showNotesDialog = true;
            }
          });
        } else {
          // Fallback to using local data if socket isn't available
          const latestTask = this.tasks.find(t => t.id === task.id);
          if (latestTask) {
            console.log("Using local task data:", latestTask);
            this.currentTask = { ...latestTask };
            this.editingNotes = latestTask.notes || '';
            this.noteTaskId = task.id;
            
            console.log("Setting notes to:", this.editingNotes);
            this.showNotesDialog = true;
          } else {
            console.error("Task not found in local data");
          }
        }
      },
      
      editSubtaskNotes(subtask) {
        this.currentTask = subtask;
        this.editingNotes = subtask.notes || '';
        this.showNotesDialog = true;
      },
      
      showTaskNotes(task) {
        this.currentTask = task;
        this.editingNotes = task.notes || '';
        this.showNotesDialog = true;
      },
      
      closeNotesDialog() {
        console.log("Closing notes dialog");
        this.showNotesDialog = false;
        this.currentTask = null;
        this.editingNotes = '';
        this.noteTaskId = null;
      },
      
      saveTaskNotes() {
        console.log("Saving notes for task:", this.currentTask?.id);
        if (!this.currentTask) {
          console.error("No current task selected");
          return;
        }
        
        console.log("Notes content:", this.editingNotes);
        
        // Store notes in database through socket
        taskOperations.updateTaskNotes(this.currentTask.id, this.editingNotes);
        
        // Update notes in local data using Vue 3 reactivity - fixed
        const taskIndex = this.tasks.findIndex(t => t.id === this.currentTask.id);
        if (taskIndex >= 0) {
          console.log("Updating local task data with new notes");
          // Vue 3 way - directly modify the array
          this.tasks[taskIndex] = { 
            ...this.tasks[taskIndex], 
            notes: this.editingNotes 
          };
        }
        
        // Show notification
        this.showNotification(`Notes ${this.editingNotes ? 'saved' : 'cleared'} for task: ${this.currentTask.name}`, 'success');
        
        // Close dialog
        this.showNotesDialog = false;
        this.currentTask = null;
        this.editingNotes = '';
        this.noteTaskId = null;
      },

      // CSV Import methods
      async importCSV() {
        if (!this.csvFile) {
          this.showNotification('Please select a CSV file', 'error');
          return;
        }

        this.csvImporting = true;
        this.csvImportResult = null;

        try {
          const formData = new FormData();
          formData.append('csvFile', this.csvFile[0]);

          const response = await fetch('/api/import-csv', {
            method: 'POST',
            body: formData
          });

          const result = await response.json();

          if (response.ok) {
            this.csvImportResult = {
              success: true,
              message: result.message,
              details: result.details
            };
            this.showNotification(result.message, 'success');
            
            // Clear the file input
            this.csvFile = null;
            
            // Refresh tasks - socket will handle this automatically
          } else {
            this.csvImportResult = {
              success: false,
              message: result.error || 'Failed to import CSV'
            };
            this.showNotification('Failed to import CSV: ' + (result.message || 'Unknown error'), 'error');
          }
        } catch (error) {
          console.error('CSV import error:', error);
          this.csvImportResult = {
            success: false,
            message: 'Error uploading file: ' + error.message
          };
          this.showNotification('Error uploading CSV file', 'error');
        } finally {
          this.csvImporting = false;
        }
      },

      downloadCSVTemplate() {
        window.location.href = '/api/csv-template';
        this.showNotification('Downloading CSV template...', 'info');
      },

      toggleAddTaskPanel() {
        this.showAddTaskPanel = !this.showAddTaskPanel;
        localStorage.setItem('showAddTaskPanel', this.showAddTaskPanel);
      },

      toggleCsvImportPanel() {
        this.showCsvImportPanel = !this.showCsvImportPanel;
        localStorage.setItem('showCsvImportPanel', this.showCsvImportPanel);
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

      // Resize panel methods
      startResize(e) {
        this.isResizing = true;
        document.addEventListener('mousemove', this.handleResize);
        document.addEventListener('mouseup', this.stopResize);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      },

      handleResize(e) {
        if (!this.isResizing) return;

        const container = this.$refs.splitContainer;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Constrain between 30% and 70%
        if (newLeftWidth >= 30 && newLeftWidth <= 70) {
          this.leftPanelWidth = newLeftWidth;
          
          // Trigger chart redraw after resize
          this.$nextTick(() => {
            if (chartVisualization && typeof chartVisualization.initializeChart === 'function') {
              chartVisualization.initializeChart();
            }
          });
        }
      },

      stopResize() {
        if (this.isResizing) {
          this.isResizing = false;
          document.removeEventListener('mousemove', this.handleResize);
          document.removeEventListener('mouseup', this.stopResize);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          
          // Save preference
          localStorage.setItem('leftPanelWidth', this.leftPanelWidth);
        }
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
    },
    mounted() {
      // Initialize socket connection first
      this.socket = io(window.location.origin);
      
      // Listen for socket connection and request data
      this.socket.on('connect', () => {
        console.log('Socket connected, requesting initial data');
        this.socket.emit('requestInitialData');
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
      
      // Initialize chart after Vue is mounted
      setTimeout(() => {
        if (chartVisualization) {
          chartVisualization.initializeChart();
        }
      }, 100);
      
      // Apply dark theme if active
        if (this.isDarkTheme) {
          document.body.classList.add('dark-theme');
      }
      
      // Make app globally available
      window.app = this;
      
      // Dispatch event to signal that app is mounted
      window.dispatchEvent(new Event('app-mounted'));
    }
  });
  
  // Mount Vuetify to the app
  app.use(vuetify);
  
  // Mount the app to the DOM
  app.mount('#app');
  
  // Make app globally available
  window.app = app._instance.proxy;
});

// Now these exports will be valid since the variables are defined at the top level
export {
  chartVisualization,
  taskOperations,
  taskListManager
}; 