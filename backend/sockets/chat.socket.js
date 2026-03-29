function registerChatSocketHandlers({ io, messagesService }) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on('sendMessage', (data) => {
      const { from, to, text, clientToken } = data || {};

      try {
        const message = messagesService.createMessage({ from, to, text, clientToken });
        io.to(`user_${from}`).to(`user_${to}`).emit('newMessage', message);
      } catch (err) {
        console.error('Message insert error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
}

module.exports = {
  registerChatSocketHandlers,
};
