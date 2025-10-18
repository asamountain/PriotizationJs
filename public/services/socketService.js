// import { io } from "../libs/socket.io.esm.min.js"; // Assuming socket.io client library path - REMOVED as io is global via CDN

let socket = null;
// ... rest of the file

export const socketService = {
  initializeSocket,
  getSocket,
  emit,
  on,
  once,
  off
};