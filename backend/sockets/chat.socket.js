function registerChatSocketHandlers({ io, messagesService }) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on('sendMessage', (data, ack) => {
      const { from, to, text, clientToken } = data || {};

      try {
        const result = messagesService.createMessage({ from, to, text, clientToken });
        if (result.status >= 400) {
          if (typeof ack === 'function') ack({ ok: false, error: result.body.error });
          return;
        }

        io.to(`user_${result.body.from_id}`).to(`user_${result.body.to_id}`).emit('newMessage', result.body);
        if (typeof ack === 'function') ack({ ok: true, message: result.body });
      } catch (err) {
        console.error('Message insert error:', err);
        if (typeof ack === 'function') ack({ ok: false, error: 'Message persistence failed' });
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
