const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { buildMessagesRepository } = require('../repositories/messages.repository');

function createInMemoryDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL,
      to_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      client_token TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return db;
}

test('messages repository creates and fetches conversation in timestamp order with limit', () => {
  const db = createInMemoryDb();
  const repo = buildMessagesRepository(db);

  repo.createMessage(1, 2, 'first', 't1');
  repo.createMessage(2, 1, 'second', 't2');
  repo.createMessage(1, 2, 'third', 't3');

  const conversation = repo.listMessagesBetweenUsers(1, 2, { limit: 2 });

  assert.equal(conversation.length, 2);
  assert.equal(conversation[0].text, 'second');
  assert.equal(conversation[1].text, 'third');

  db.close();
});
