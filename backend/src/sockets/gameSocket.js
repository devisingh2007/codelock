let ioInstance = {
  to: () => ({
    emit: (event, data) => {
      // Mock/Placeholder for events:
      // - 'player-joined': { playerId, roomCode }
      // - 'room-deleted': { roomCode }
      // - 'player-left': { playerId, roomCode }
      console.log(`[Socket Placeholder] Emitted to room: ${event}`, data);
    }
  }),
  emit: (event, data) => {
    // Mock/Placeholder for events:
    // - 'room-created': { roomCode, hostId }
    console.log(`[Socket Placeholder] Emitted globally: ${event}`, data);
  }
};

const initSocket = (server) => {
  const { Server } = require("socket.io");
  const io = new Server(server, {
    cors: {
      origin: "*",
    }
  });
  ioInstance = io;
  
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    socket.on("join-room", (roomCode) => {
      socket.join(roomCode);
      console.log(`Socket ${socket.id} joined room ${roomCode}`);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = {
  initSocket,
  get io() {
    return ioInstance;
  }
};
