function registerChatSocketHandlers({ io, messagesService, jwtAuthService, validateSocketUserToken, logger = console }) {
  const resolvedLogger = logger || {};

  io.on('connection', (socket) => {
    if (typeof resolvedLogger.log === 'function') resolvedLogger.log('User connected:', socket.id);

    const token = _extractSocketToken(socket);
    if (!jwtAuthService || !token) {
      socket.disconnect(true);
      return;
    }

    let claims;
    try {
      claims = jwtAuthService.verifyToken(token);
    } catch (_err) {
      socket.disconnect(true);
      return;
    }
    const tokenUserId = _parsePositiveInt(claims.sub);
    if (!tokenUserId) {
      socket.disconnect(true);
      return;
    }

    if (typeof validateSocketUserToken === 'function') {
      const validation = validateSocketUserToken({ userId: tokenUserId, tokenVersion: claims.token_version });
      if (!validation || validation.ok !== true) {
        socket.disconnect(true);
        return;
      }
    }

    socket.data.userId = tokenUserId;

    // ─── Authentication ───────────────────────────────────────────────────────
    // The socket JWT is verified during connection setup above. The client still
    // calls `join` with its userId, but that value is only used to confirm the
    // socket joins its own room and cannot subscribe to another user's room.
    // Token revocation/deletion checks must be enforced by `validateSocketUserToken`
    // so WebSocket behavior stays aligned with protected HTTP routes.
    // ─────────────────────────────────────────────────────────────────────────

    socket.on('join', (userId) => {
      const parsed = _parsePositiveInt(userId);
      if (!parsed || parsed !== socket.data.userId) {
        socket.disconnect(true);
        return;
      }
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
        if (typeof ack === 'function') {
          ack({ ok: true, message: result.body });
        }
      } catch (err) {
        if (typeof resolvedLogger.error === 'function') resolvedLogger.error('Message insert error:', err);
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Message persistence failed.' });
        }
      }
    });

    socket.on('disconnect', () => {
      if (typeof resolvedLogger.log === 'function') resolvedLogger.log(`User disconnected: ${socket.id} (was user ${socket.data.userId ?? 'unknown'})`);
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

function _extractSocketToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();
  const queryToken = socket.handshake?.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();
  const header = socket.handshake?.headers?.authorization;
  if (typeof header === 'string') {
    const lower = header.toLowerCase();
    if (lower.startsWith('bearer ')) return header.slice(7).trim();
  }
  return null;
}

module.exports = {
  registerChatSocketHandlers,
};
