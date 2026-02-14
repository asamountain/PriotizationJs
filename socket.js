import { getTaskData, addTask, modifyTask, deleteTask, toggleTaskDone, editTask, updateTaskNotes, startTimer, stopTimer, getTimeLogs, setTaskParent } from "./db.js";
import database from "./db.js";

const setupSocket = (io) => {
  // Process tasks to ensure numeric values
  const processTaskData = (tasks) => {
    console.log("SOCKET: Processing task data - before processing:", tasks.slice(0, 2));  
    
    const processed = tasks.map((task) => {
      const result = {
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
        // Timer fields
        total_time_spent: task.total_time_spent || 0,
        active_timer_start: task.active_timer_start || null,
        pomodoro_count: task.pomodoro_count || 0,
        last_worked_at: task.last_worked_at || null
      };
      
      // Debug logging for link
      if (task.link) {
        console.log(`SOCKET: Task ${task.id} link before: ${task.link}, after: ${result.link}`);
      }
      
      return result;
    });
    
    console.log("SOCKET: After processing - sample:", processed.slice(0, 2));
    return processed;
  };
  io.on("connection", (socket) => {
    console.log("New client connected");
    
    // Store userId on the socket
    socket.userId = null;

    // Handle authentication from client
    socket.on("authenticate", async (userId) => {
      console.log(`SOCKET: Authenticating socket for user: ${userId}`);
      socket.userId = userId;
      
      // Refresh data for this specific user
      try {
        const data = await getTaskData(socket.userId);
        socket.emit("initialData", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to fetch data after auth:", error);
      }
    });

    // Send initial data (public tasks initially, or user tasks if already auth'd)
    getTaskData(socket.userId)
      .then((data) => {
        const processedData = processTaskData(data);
        console.log("Initial data fetched:", processedData.length, "items");
        socket.emit("initialData", { data: processedData });
      })
      .catch((error) => {
        console.error("Failed to fetch initial data:", error);
        socket.emit("initialData", { data: [] });
      });

    socket.on("addTask", async (task) => {
      try {
        console.log(`Adding task for user ${socket.userId || 'anonymous'}:`, task);
        const taskId = await addTask(task, socket.userId);
        console.log("Task added successfully, ID:", taskId);

        const data = await getTaskData(socket.userId);
        // Use io.to(...) or just io.emit but we should filter by user
        // For simplicity now, we'll emit to all but the client will only see their own when they request
        // Better: broadcast only to this user's rooms
        if (socket.userId) {
          // If we had rooms, we'd use io.to(socket.userId).emit(...)
          socket.emit("updateTasks", { data: processTaskData(data) });
          // Also emit to other sockets of the same user if we implement rooms
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
        const data = await getTaskData(socket.userId);
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
        const data = await getTaskData(socket.userId);
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
        const data = await getTaskData(socket.userId);
        socket.emit("updateTasks", { data: processTaskData(data) });
      } catch (error) {
        console.error("Failed to update tasks:", error);
      }
    });

    socket.on("toggleDone", async (id) => {
      try {
        await toggleTaskDone(id);
        const data = await getTaskData(socket.userId);
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
        const data = await getTaskData(socket.userId);
        if (socket.userId) {
          socket.emit("updateTasks", { data: processTaskData(data) });
        } else {
          io.emit("updateTasks", { data: processTaskData(data) });
        }
      } catch (error) {
        console.error("Failed to add subtask:", error);
      }
    });

    socket.on("updateSubtask", async ({ subtask }) => {
      try {
        await database.updateSubtask(subtask);
        const data = await getTaskData(socket.userId);
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
        const data = await getTaskData(socket.userId);
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
        const data = await getTaskData(socket.userId);
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
            completed_at: task.completed_at
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
        const data = await getTaskData(socket.userId);
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
        const data = await getTaskData(socket.userId);
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
        const tasks = await getTaskData(socket.userId);
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
        
        const data = await getTaskData(socket.userId);
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

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });
};


export default setupSocket;
