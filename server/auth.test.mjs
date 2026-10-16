import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { createAuth, hashPassword, verifyPassword } from './auth.mjs'

test('Passwords are salted, hashed and verified', async () => {
  const first = await hashPassword('a long test password')
  const second = await hashPassword('a long test password')
  assert.notEqual(first, second)
  assert.equal(await verifyPassword('a long test password', first), true)
  assert.equal(await verifyPassword('wrong test password', first), false)
})

test('Registration, session, ownership, CSRF and logout', async () => {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE orders (id TEXT PRIMARY KEY,total INTEGER,status TEXT,created TEXT,data TEXT)')
  const auth = createAuth(db, { origin: 'https://oscal.example' })
  async function request(path, method = 'GET', input = {}, cookie = '', origin = 'https://oscal.example') {
    const req = { method, headers: { cookie, origin, 'content-type': 'application/json' }, socket: { remoteAddress: 'test' } }
    const result = { status: 0, body: null, headers: {} }
    await auth.handle(req, { setHeader(k,v) { result.headers[k] = v } }, path, async () => input, (_res, status, body) => { result.status = status; result.body = body })
    return result
  }
  const profile = { name: 'Test Person', email: 'TEST@example.com', password: 'long secure test password' }
  assert.equal((await request('/api/auth/register', 'POST', profile, '', 'https://evil.example')).status, 403)
  assert.equal((await request('/api/auth/register', 'POST', { ...profile, password: 'short' })).status, 400)
  const created = await request('/api/auth/register', 'POST', profile)
  assert.equal(created.status, 200)
  assert.equal(created.body.user.email, 'test@example.com')
  assert.equal(created.body.user.password, undefined)
  assert.match(created.headers['Set-Cookie'], /HttpOnly; SameSite=Lax/)
  assert.match(created.headers['Set-Cookie'], /Secure/)
  const cookie = created.headers['Set-Cookie'].split(';')[0]
  assert.equal((await request('/api/auth/session', 'GET', {}, cookie)).body.user.id, created.body.user.id)
  assert.equal((await request('/api/auth/session', 'GET', {}, 'oscal_session=invalid')).body.user, null)
  assert.equal((await request('/api/auth/login', 'POST', { ...profile, password: 'wrong long password' })).status, 401)
  assert.equal((await request('/api/auth/address', 'PUT', { street: 'Example 123', city: 'Montevideo' }, cookie)).body.user.address.street, 'Example 123')
  db.prepare('INSERT INTO orders VALUES (?,?,?,?,?)').run('mine', 123, 'demo', '2026-10-11', '{"items":[]}')
  db.prepare('INSERT INTO orders VALUES (?,?,?,?,?)').run('other', 456, 'demo', '2026-10-11', '{"items":[]}')
  db.prepare('INSERT INTO order_users VALUES (?,?)').run('mine', created.body.user.id)
  db.prepare('INSERT INTO order_users VALUES (?,?)').run('other', 'another-user')
  assert.deepEqual((await request('/api/account/orders', 'GET', {}, cookie)).body.orders.map(o => o.id), ['mine'])
  assert.equal((await request('/api/account/orders')).status, 401)
  await request('/api/auth/logout', 'POST', {}, cookie)
  assert.equal((await request('/api/auth/session', 'GET', {}, cookie)).body.user, null)
  assert.equal((await request('/api/auth/login', 'POST', profile)).status, 200)
  db.close()
})

test('Repeated authentication attempts are limited', async () => {
  const db = new DatabaseSync(':memory:')
  const auth = createAuth(db, { origin: 'https://oscal.example' })
  let code
  for (let i = 0; i < 16; i++) await auth.handle({ method: 'POST', headers: { origin: 'https://oscal.example', 'content-type': 'application/json' }, socket: { remoteAddress: 'test' } }, {}, '/api/auth/login', async () => ({}), (_res, status) => { code = status })
  assert.equal(code, 429)
  db.close()
})
