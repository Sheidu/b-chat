const test = require('node:test');
const assert = require('node:assert/strict');
const { registerChatSocketHandlers } = require('../sockets/chat.socket');

const silentLogger = { log() {}, error() {} };

function createFakeIo() {
  let connectionHandler;
  return {
    on(event, handler) {
      if (event === 'connection') connectionHandler = handler;
    },
    connect(socket) {
      connectionHandler(socket);
    },
    to() {
      return this;
    },
    emit() {},
  };
}

function createFakeSocket(token = 'valid-token') {
  return {
    id: 'socket-1',
    data: {},
    disconnected: false,
    handshake: { auth: { token } },
    disconnect(force) {
      this.disconnected = true;
      this.forceDisconnect = force;
    },
    on() {},
    join() {},
  };
}

test('chat socket rejects revoked or deleted users through validator', () => {
  const io = createFakeIo();
  const socket = createFakeSocket();

  registerChatSocketHandlers({
    io,
    messagesService: { createMessage() {} },
    jwtAuthService: {
      verifyToken(token) {
        assert.equal(token, 'valid-token');
        return { sub: '5', token_version: 2 };
      },
    },
    validateSocketUserToken({ userId, tokenVersion }) {
      assert.equal(userId, 5);
      assert.equal(tokenVersion, 2);
      return { ok: false };
    },
    logger: silentLogger,
  });

  io.connect(socket);

  assert.equal(socket.disconnected, true);
  assert.equal(socket.data.userId, undefined);
});

test('chat socket accepts valid current user token and join only allows own room', () => {
  const io = createFakeIo();
  const joined = [];
  const handlers = {};
  const socket = {
    ...createFakeSocket(),
    on(event, handler) {
      handlers[event] = handler;
    },
    join(room) {
      joined.push(room);
    },
  };

  registerChatSocketHandlers({
    io,
    messagesService: { createMessage() {} },
    jwtAuthService: {
      verifyToken() {
        return { sub: '5', token_version: 2 };
      },
    },
    validateSocketUserToken() {
      return { ok: true };
    },
    logger: silentLogger,
  });

  io.connect(socket);
  handlers.join(5);

  assert.equal(socket.disconnected, false);
  assert.equal(socket.data.userId, 5);
  assert.deepEqual(joined, ['user_5']);
});
