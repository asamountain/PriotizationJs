import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = (onTasksUpdate: (tasks: any[]) => void) => {
  // In development, we might need to point to the backend port (e.g., 3000)
  // In production, it would be the same origin
  const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
  
  socket = io(socketUrl);

  socket.on('connect', () => {
    console.log('Connected to server');
    socket?.emit('requestInitialData');
  });

  socket.on('initialData', (data) => {
    const taskData = data && data.data ? data.data : data;
    if (Array.isArray(taskData)) onTasksUpdate(taskData);
  });

  socket.on('updateTasks', (data) => {
    const taskData = data && data.data ? data.data : data;
    if (Array.isArray(taskData)) onTasksUpdate(taskData);
  });

  return socket;
};

export const addTask = (task: any) => socket?.emit('addTask', task);
export const toggleDone = (taskId: number) => socket?.emit('toggleDone', taskId);
export const deleteTask = (taskId: number) => socket?.emit('deleteTask', taskId);
export const addSubtask = (subtask: any, parentId: number) => socket?.emit('addSubtask', { subtask, parentId });
export const updateSubtask = (subtask: any) => socket?.emit('updateSubtask', { subtask });
