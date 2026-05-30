const { Server } = require('socket.io');

function setupSocket(server) {
  const io = new Server(server, {
    cors: { 
      origin: ["http://localhost:4000", "https://loveamon.onrender.com"],
      credentials: true 
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });

    socket.on('send_message', (data) => {
      // Broadcast to receiver's room
      io.to(data.receiverId).emit('receive_message', {
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}

module.exports = setupSocket;