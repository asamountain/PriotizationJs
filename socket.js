import { getTaskData, addTask, modifyTask, deleteTask, toggleTaskDone, editTask, updateTaskNotes, startTimer, stopTimer, getTimeLogs, setTaskParent, addTaskRelationship, removeTaskRelationship, getTaskRelationships, calculateLeverageScore } from "./db.js";
import database from "./db.js";

const setupSocket = (io) => {
  // Process tasks to ensure numeric values
  const processTaskData = (tasks) => {
    // Only log first 2 tasks and total count to avoid log bloat
    console.log(`SOCKET: Processing ${tasks.length} tasks`);

    return tasks.map((task) => {
      return {
        id: task.id,
        name: task.name,
        importance: Number(task.importance) || 0,
        urgency: Number(task.urgency) || 0,
        done: task.done === 1 || task.done === true || task.done === "true",
        created_at: task.created_at,
        completed_at: task.completed_at,
        parent_id: task.parent_id,
        link: task.link || null,
        due_date: task.due_date || null,
        notes: task.notes || null,
        progress: task.progress ? Number(task.progress) : null,
        category: task.category || null,
        status: task.status || null,
        icon: task.icon || 'mdi-checkbox-blank-circle-outline',
        color: task.color || null,
        // Timer fields
        total_time_spent: task.total_time_spent || 0,
        active_timer_start: task.active_timer_start || null,
        pomodoro_count: task.pomodoro_count || 0,
        last_worked_at: task.last_worked_at || null,
        // Leverage score
        leverage_score: task.leverage_score || 0
      };
    });
  };

  // Helper function to get tasks with leverage scores
  const getTasksWithLeverage = async (userId) => {
    return database.getTaskDataWithLeverage(userId);
  };
  io.on("connection", (socket) => {
    console.log("New client connected");
    
    // Store userId on the socket
    socket.userId = null;
    let dataFetched = false;

    // Handle authentication from client
    socket.on("authenticate", async (userId) => {
      console.log(`SOCKET: Authenticating socket for user: ${userId}`);
      
      // If already authenticated with same ID, don't re-fetch unless forced
      if (socket.userId === userId && dataFetched) {
        console.log(`SOCKET: Already authenticated as ${userId}, skipping redundant fetch`);
        return;
      }

      socket.userId = userId;

      // Refresh data for this specific user (with leverage scores)
      try {
        const data = await getTasksWithLeverage(socket.userId);
        const processed = processTaskData(data);
        console.log(`SOCKET: Sending ${processed.length} items to authenticated user ${userId}`);
        socket.emit("initialData", { data: processed });
        dataFetched = true;
      } catch (error) {
        console.error("Failed to fetch data after auth:", error);
      }
    });

    // Explicit request for initial data
    socket.on("requestInitialData", async () => {
      console.log(`SOCKET: requestInitialData from user: ${socket.userId || 'anonymous'}`);
      try {
        const data = await getTasksWithLeverage(socket.userId);
        const processed = processTaskData(data);
        console.log(`SOCKET: Sending ${processed.length} items for requestInitialData`);
        socket.emit("initialData", { data: processed });
        dataFetched = true;
      } catch (error) {
        console.error("Failed to fetch initial data on request:", error);
        socket.emit("initialData", { data: [] });
      }
    });

    socket.on("addTask", async (task) => {
      try {
        console.log(`Adding task for user ${socket.userId || 'anonymous'}:`, task);
        const taskId = await addTask(task, socket.userId);
        console.log("Task added successfully, ID:", taskId);

        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to add task:", error);
      }
    });

    socket.on("modifyTask", async (task) => {
      try {
        await modifyTask(task);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to modify task:", error);
      }
    });

    socket.on("deleteTask", async (id) => {
      try {
        await deleteTask(id);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    });

    socket.on("updateTasks", async () => {
      try {
        const data = await getTasksWithLeverage(socket.userId);
        socket.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to update tasks:", error);
      }
    });

    socket.on("toggleDone", async (id) => {
      try {
        await toggleTaskDone(id);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to toggle task done status:", error);
      }
    });

    socket.on("addSubtask", async ({ subtask, parentId }) => {
      try {
        const subtaskId = await database.addSubtask(subtask, parentId, socket.userId);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to add subtask:", error);
        socket.emit("error", { message: "Failed to add subtask. Please try again." });
      }
    });

    socket.on("updateSubtask", async ({ subtask }) => {
      try {
        await database.updateSubtask(subtask);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to update subtask:", error);
      }
    });

    socket.on("editTask", async (task) => {
      try {
        await editTask(task);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to edit task:", error);
      }
    });

    socket.on("updateTaskNotes", async ({ taskId, notes }) => {
      try {
        await updateTaskNotes(taskId, notes);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to update task notes:", error);
      }
    });

    socket.on("getTaskDetails", async ({ taskId }) => {
      try {
        console.log("Fetching details for task ID:", taskId);
        
        // Use the database query abstraction to work with both SQLite and Postgres
        const tasks = await database.query(
          database.pool ? "SELECT * FROM tasks WHERE id = $1" : "SELECT * FROM tasks WHERE id = ?",
          [taskId]
        );
        
        const task = tasks[0];
        
        if (task) {
          console.log("Task details retrieved:", task);
          console.log("Task notes:", task.notes);
          
          // Format the task data consistently with other responses
          const formattedTask = {
            id: task.id,
            name: task.name,
            importance: Number(task.importance) || 0,
            urgency: Number(task.urgency) || 0,
            done: task.done === 1 || task.done === true || task.done === "true",
            created_at: task.created_at,
            parent_id: task.parent_id,
            due_date: task.due_date,
            link: task.link,
            notes: task.notes,
            completed_at: task.completed_at,
            category: task.category,
            status: task.status,
            icon: task.icon || 'mdi-checkbox-blank-circle-outline',
            color: task.color || null,
            total_time_spent: task.total_time_spent || 0,
            active_timer_start: task.active_timer_start || null,
            pomodoro_count: task.pomodoro_count || 0,
            last_worked_at: task.last_worked_at || null
          };
          
          socket.emit("taskDetails", formattedTask);
        } else {
          console.error("Task not found:", taskId);
          socket.emit("taskDetails", null);
        }
      } catch (error) {
        console.error("Error fetching task details:", error);
        socket.emit("taskDetails", null);
      }
    });

    // Timer handlers
    socket.on("startTimer", async (taskId) => {
      try {
        console.log("Starting timer for task:", taskId);
        const result = await startTimer(taskId);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
        socket.emit("timerStarted", result);
      } catch (error) {
        console.error("Failed to start timer:", error);
        socket.emit("timerError", { error: error.message });
      }
    });

    socket.on("stopTimer", async (taskId) => {
      try {
        console.log("Stopping timer for task:", taskId);
        const result = await stopTimer(taskId);
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
        socket.emit("timerStopped", result);
      } catch (error) {
        console.error("Failed to stop timer:", error);
        socket.emit("timerError", { error: error.message });
      }
    });

    socket.on("getTimeLogs", async (taskId) => {
      try {
        console.log("Getting time logs for task:", taskId);
        const logs = await getTimeLogs(taskId);
        socket.emit("timeLogs", { taskId, logs });
      } catch (error) {
        console.error("Failed to get time logs:", error);
        socket.emit("timeLogsError", { error: error.message });
      }
    });

    // Set task parent (create subtask relationship)
    socket.on("setTaskParent", async ({ taskId, parentId }) => {
      try {
        console.log(`SOCKET: Setting parent for task ${taskId} to ${parentId} (user: ${socket.userId || 'anonymous'})`);
        await setTaskParent(taskId, parentId);
        
        // Broadcast updated tasks to all clients
        const tasks = await getTasksWithLeverage(socket.userId);
        console.log(`SOCKET: Fetched ${tasks.length} tasks after parent change`);
        
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(tasks) });
        } else {
          io.emit("updateTasks", { data: processTaskData(tasks) });
        }
        
        socket.emit("taskParentSet", { taskId, parentId });
      } catch (error) {
        console.error("Failed to set task parent:", error);
        socket.emit("setTaskParentError", { error: error.message });
      }
    });

    socket.on("updateTaskStatus", async ({ taskId, status }) => {
      try {
        console.log(`Updating status for task ${taskId} to ${status}`);
        await database.updateTaskStatus(taskId, status);
        
        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to update task status:", error);
        socket.emit("error", { message: "Failed to update status" });
      }
    });

    socket.on("updateTaskIcon", async ({ taskId, icon }) => {
      try {
        console.log(`Updating icon for task ${taskId} to ${icon}`);
        await database.updateTaskIcon(taskId, icon);

        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to update task icon:", error);
        socket.emit("error", { message: "Failed to update icon" });
      }
    });

    socket.on("updateTaskColor", async ({ taskId, color }) => {
      try {
        console.log(`Updating color for task ${taskId} to ${color}`);
        await database.updateTaskColor(taskId, color);

        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to update task color:", error);
        socket.emit("error", { message: "Failed to update color" });
      }
    });

    // Task Relationship handlers for Leverage Score
    socket.on("addTaskRelationship", async ({ enablerId, enabledId }) => {
      try {
        console.log(`Adding relationship: task ${enablerId} enables task ${enabledId}`);
        await addTaskRelationship(enablerId, enabledId, socket.userId);

        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
        socket.emit("relationshipAdded", { enablerId, enabledId });
      } catch (error) {
        console.error("Failed to add task relationship:", error);
        socket.emit("error", { message: "Failed to add relationship" });
      }
    });

    socket.on("removeTaskRelationship", async ({ enablerId, enabledId }) => {
      try {
        console.log(`Removing relationship: task ${enablerId} enables task ${enabledId}`);
        await removeTaskRelationship(enablerId, enabledId);

        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
        socket.emit("relationshipRemoved", { enablerId, enabledId });
      } catch (error) {
        console.error("Failed to remove task relationship:", error);
        socket.emit("error", { message: "Failed to remove relationship" });
      }
    });

    socket.on("getTaskRelationships", async (taskId) => {
      try {
        if (taskId === null) {
          console.log(`Getting all relationships for user ${socket.userId || 'anonymous'}`);
          const relationships = await database.getAllTaskRelationships(socket.userId);
          socket.emit("taskRelationships", { taskId: null, relationships });
        } else {
          console.log(`Getting relationships for task ${taskId}`);
          const relationships = await getTaskRelationships(taskId);
          socket.emit("taskRelationships", { taskId, ...relationships });
        }
      } catch (error) {
        console.error("Failed to get task relationships:", error);
        socket.emit("error", { message: "Failed to get relationships" });
      }
    });

    socket.on("addTaskWithRelationships", async ({ task, enables }) => {
      try {
        console.log(`Adding task with relationships for user ${socket.userId || 'anonymous'}:`, task);
        const taskId = await addTask(task, socket.userId);
        console.log("Task added successfully, ID:", taskId);

        // Add relationships if provided
        if (enables && enables.length > 0) {
          for (const enabledId of enables) {
            await addTaskRelationship(taskId, enabledId, socket.userId);
          }
          console.log(`Added ${enables.length} relationships for task ${taskId}`);
        }

        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to add task with relationships:", error);
      }
    });

    socket.on("updateTaskRelationships", async ({ taskId, enables }) => {
      try {
        console.log(`Updating relationships for task ${taskId}:`, enables);

        // Get current relationships
        const currentRelationships = await getTaskRelationships(taskId);
        const currentEnables = currentRelationships.enables.map(t => t.id);

        // Find relationships to add and remove
        const toAdd = enables.filter(id => !currentEnables.includes(id));
        const toRemove = currentEnables.filter(id => !enables.includes(id));

        // Remove old relationships
        for (const enabledId of toRemove) {
          await removeTaskRelationship(taskId, enabledId);
        }

        // Add new relationships
        for (const enabledId of toAdd) {
          await addTaskRelationship(taskId, enabledId, socket.userId);
        }

        console.log(`Updated relationships: added ${toAdd.length}, removed ${toRemove.length}`);

        const data = await getTasksWithLeverage(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to update task relationships:", error);
        socket.emit("error", { message: "Failed to update relationships" });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });
};


export default setupSocket;
