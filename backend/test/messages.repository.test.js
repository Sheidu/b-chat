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


test('messages repository supports composite cursor (timestamp + id) for stable paging', () => {
  const db = createInMemoryDb();
  const repo = buildMessagesRepository(db);

  db.exec(`
    INSERT INTO messages (from_id, to_id, text, client_token, timestamp) VALUES
    (1,2,'m1','c1','2026-01-01T00:00:00.000Z'),
    (2,1,'m2','c2','2026-01-01T00:00:00.000Z'),
    (1,2,'m3','c3','2026-01-01T00:00:01.000Z')
  `);

  const firstPage = repo.listMessagesBetweenUsers(1, 2, { limit: 2 });
  assert.equal(firstPage.length, 2);
  const boundary = firstPage[0];

  const nextPage = repo.listMessagesBetweenUsers(1, 2, {
    before: { timestamp: boundary.timestamp, id: boundary.id },
    limit: 2,
  });

  assert.equal(nextPage.length, 1);
  assert.equal(nextPage[0].text, 'm1');

  db.close();
});
