import test from 'node:test'
import assert from 'node:assert/strict'
import { SqliteDatabase, transaction } from './database.mjs'

test('SQLite async adapter isolates a transaction across awaits and rolls back before queued reads', async () => {
  const db = new SqliteDatabase(':memory:')
  try {
    await db.exec('CREATE TABLE fixture(id INTEGER PRIMARY KEY)')
    let entered, release
    const ready = new Promise(resolve => { entered = resolve })
    const barrier = new Promise(resolve => { release = resolve })
    const pending = transaction(db, async () => {
      await db.prepare('INSERT INTO fixture VALUES(?)').run(1)
      entered()
      await barrier
      throw new Error('rollback fixture')
    })
    const rejected = assert.rejects(pending, /rollback fixture/)
    await ready
    const read = db.prepare('SELECT count(*) AS n FROM fixture').get()
    release()
    await rejected
    assert.equal((await read).n, 0)
    await transaction(db, async () => { await db.prepare('INSERT INTO fixture VALUES(?)').run(2) })
    assert.equal((await db.prepare('SELECT id FROM fixture').get()).id, 2)
  } finally { await db.close() }
})
