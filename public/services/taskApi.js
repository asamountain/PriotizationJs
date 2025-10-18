import { socketService } from './socketService.js';
import { notificationService } from './notificationService.js';

/**
 * Requests the initial set of tasks and user data from the server.
 * Should be called once after the socket connects.
 */
const requestInitialData = () => {
  console.log('Requesting initial data...');
  socketService.emit('requestInitialData');
};

/**
 * Sends a new task to the server to be added.
 * @param {object} taskData The task details (e.g., { name, link, importance, urgency }).
 * @returns {Promise<object>} A promise that resolves with the server response or rejects on error.
 */
const addTask = (taskData) => {
  return new Promise((resolve, reject) => {
    if (!taskData || !taskData.name) {
      console.error('Invalid task data provided to addTask:', taskData);
      notificationService.showNotification('Cannot add task: Invalid data.', 'error', '❌');
      return reject(new Error('Invalid task data'));
    }

    console.log('Emitting addTask event with data:', taskData);
    // Listen for the specific response to *this* add operation
    const onTaskAdded = (response) => {
        console.log('Received taskAdded response:', response);
        socketService.off('taskAdded', onTaskAdded); // Clean up listener
        if (response && response.success) {
            notificationService.showNotification(`Task added: ${taskData.name}`, 'success', '✅');
            resolve(response);
        } else {
            const errorMsg = (response && response.message) || 'Failed to add task on server.';
            console.error('addTask failed:', errorMsg);
            notificationService.showNotification(`Error adding task: ${errorMsg}`, 'error', '❌');
            reject(new Error(errorMsg));
        }
    };
    
    socketService.once('taskAdded', onTaskAdded); // Use once for specific response
    socketService.emit('addTask', taskData);
    
    // Timeout for the response
    setTimeout(() => {
        socketService.off('taskAdded', onTaskAdded); // Clean up listener if timeout
        reject(new Error('Add task request timed out.'));
    }, 10000); // 10 second timeout

  });
};

/**
 * Sends a request to toggle the completion status of a task.
 * @param {number|string} taskId The ID of the task to toggle.
 * @param {string} [taskName=''] Optional: Name of the task for notification purposes.
 * @param {boolean} [currentDoneState] Optional: Current completion state for better notifications.
 */
const toggleDone = (taskId, taskName = '', currentDoneState) => {
  console.log(`Emitting toggleDone event for task ID: ${taskId}`);
  socketService.emit('toggleDone', taskId);

  // Show optimistic notification (will be updated by 'updateTasks' event anyway)
  const actionTaken = currentDoneState ? 'reopened' : 'completed';
  const icon = currentDoneState ? '🔄' : '🎉';
  const nameText = taskName ? `: ${taskName}` : '';
  notificationService.showNotification(`Task ${actionTaken}${nameText}`, 'success', icon);
};

/**
 * Sends a request to delete a task.
 * @param {number|string} taskId The ID of the task to delete.
 */
const deleteTask = (taskId) => {
  console.log(`Emitting deleteTask event for task ID: ${taskId}`);
  socketService.emit('deleteTask', taskId);
  // Notification will likely be handled by 'updateTasks' or a specific 'taskDeleted' event
};

/**
 * Sends a request to add a subtask to a parent task.
 * @param {object} subtaskData The subtask details.
 * @param {number|string} parentId The ID of the parent task.
 * @param {string} [parentName=''] Optional: Name of the parent task for notifications.
 */
const addSubtask = (subtaskData, parentId, parentName = '') => {
  if (!subtaskData || !subtaskData.name || !parentId) {
    console.error('Invalid data for addSubtask:', { subtaskData, parentId });
    notificationService.showNotification('Cannot add subtask: Invalid data.', 'error', '❌');
    return; // Or return a rejected promise
  }
  console.log(`Emitting addSubtask for parent ${parentId}:`, subtaskData);
  socketService.emit('addSubtask', { subtask: subtaskData, parentId });

  // Optimistic notification (actual success/failure might come via 'updateTasks')
  const parentText = parentName ? ` to "${parentName}"` : '';
  notificationService.showNotification(`Added subtask "${subtaskData.name}"${parentText}`, 'success', '✅');
};

/**
 * Sends a request to update an existing subtask.
 * @param {object} subtaskData The updated subtask details (must include subtask ID).
 */
const updateSubtask = (subtaskData) => {
  if (!subtaskData || !subtaskData.id) {
     console.error('Invalid data for updateSubtask (missing ID):', subtaskData);
     notificationService.showNotification('Cannot update subtask: Invalid data.', 'error', '❌');
     return; // Or return a rejected promise
  }
  console.log(`Emitting updateSubtask for subtask ID ${subtaskData.id}:`, subtaskData);
  socketService.emit('updateSubtask', { subtask: subtaskData });

  // Optimistic notification
  notificationService.showNotification(`Updated subtask "${subtaskData.name}"`, 'success', '✏️');
};

/**
 * Sends updated task data (e.g., position after drag-and-drop) to the server.
 * @param {object} taskData The updated task details (must include ID).
 */
const updateTask = (taskData) => {
    if (!taskData || !taskData.id) {
        console.error('Invalid data for updateTask (missing ID):', taskData);
        notificationService.showNotification('Cannot update task: Invalid data.', 'error', '❌');
        return; // Or return a rejected promise
    }
    console.log(`Emitting updateTask for task ID ${taskData.id}:`, taskData);
    socketService.emit('updateTask', taskData);
    // Notifications usually handled by 'updateTasks' event from server
};


export const taskApi = {
  requestInitialData,
  addTask,
  toggleDone,
  deleteTask,
  addSubtask,
  updateSubtask,
  updateTask,
}; 