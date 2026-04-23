function registerChatSocketHandlers({ io, messagesService }) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // ─── Authentication ───────────────────────────────────────────────────────
    // The client calls `join` immediately after connecting and passes its userId.
    // We store that value on the socket so every subsequent handler can verify
    // the caller is who they claim to be.
    //
    // NOTE: this is a lightweight trust model suitable for a private family app.
    // For a public deployment, replace this with a signed JWT / session cookie
    // that is validated here instead of trusting the client-supplied value.
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('join', (userId) => {
      const parsed = _parsePositiveInt(userId);
      if (!parsed) {
        socket.disconnect(true);
        return;
      }

      // Prevent re-joining with a different identity on the same socket.
      if (socket.data.userId !== undefined && socket.data.userId !== parsed) {
        socket.disconnect(true);
        return;
      }

      socket.data.userId = parsed;
      socket.join(`user_${parsed}`);
    });

    socket.on('sendMessage', (data, ack) => {
      // 1. Ensure the socket has authenticated via `join`.
      const authenticatedUserId = socket.data.userId;
      if (!authenticatedUserId) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Not authenticated.' });
        }
        return;
      }

      const { from, to, text, clientToken } = data || {};

      // 2. Verify the `from` field matches the socket's authenticated identity.
      //    This prevents any connected user from forging messages as someone else.
      const fromParsed = _parsePositiveInt(from);
      if (!fromParsed || fromParsed !== authenticatedUserId) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Sender identity mismatch.' });
        }
        return;
      }
      try {
        const result = messagesService.createMessage({ from, to, text, clientToken });
        if (result.status >= 400) {
          if (typeof ack === 'function') {
            ack({ ok: false, error: result.body.error });
          }
          return;
        }

        io.to(`user_${result.body.from_id}`).to(`user_${result.body.to_id}`).emit('newMessage', result.body);
        io.to(`user_${result.body.from_id}`).emit('usersChanged', { type: 'contactsUpdated' });
        io.to(`user_${result.body.to_id}`).emit('usersChanged', { type: 'contactsUpdated' });
        if (typeof ack === 'function') {
          ack({ ok: true, message: result.body });
        }
      } catch (err) {
        console.error('Message insert error:', err);
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Message persistence failed.' });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id} (was user ${socket.data.userId ?? 'unknown'})`);
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function _parsePositiveInt(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

module.exports = {
  registerChatSocketHandlers,
};
