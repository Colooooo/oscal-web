import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createLimiter, clientAddress } from './security.mjs'
const derive = promisify(scrypt)
const digest = value => createHash('sha256').update(value).digest('hex')
const cookieName = 'oscal_session'
const lifetime = 7 * 24 * 60 * 60 * 1000
export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const key = await derive(password, salt, 64, { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 })
  return `${salt}:${key.toString('hex')}`
}
export async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':')
  const actual = (await hashPassword(password, salt)).split(':')[1]
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
}
const text = (value, max = 120) => typeof value === 'string' && value.trim().length <= max ? value.trim() : ''
const emailOf = value => text(value).toLowerCase()
const passwordValid = value => typeof value === 'string' && value.length >= 12 && value.length <= 128

export function createAuth(db, { origin, trustedProxies = [], mailer = null }) {
  const secure = origin.startsWith('https://')
  db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, address TEXT NOT NULL DEFAULT '{}', created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS order_users (order_id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS order_users_user ON order_users(user_id);`)
  if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'verified')) db.exec('ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0')
  db.exec("CREATE TABLE IF NOT EXISTS account_tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,purpose TEXT NOT NULL,expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS account_tokens_expiry ON account_tokens(expires)")
  const rate = createLimiter(db)
  let activeHashes = 0
  const limited = key => rate(key, 15, 15 * 60000)
  const sessionToken = req => req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || ''
  function user(req) {
    const token = sessionToken(req)
    if (!/^[a-f0-9]{64}$/.test(token)) return null
    return db.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires > ?').get(digest(token), Date.now()) || null
  }
  function publicUser(u) { return { id: u.id, name: u.name, email: u.email, address: JSON.parse(u.address), verified: Boolean(u.verified) } }
  function setSession(req, res, id) {
    db.prepare('DELETE FROM sessions WHERE token = ? OR expires <= ?').run(digest(sessionToken(req)), Date.now())
    const token = randomBytes(32).toString('hex')
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), id, Date.now() + lifetime)
    res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${lifetime / 1000}${secure ? '; Secure' : ''}`)
  }
  function sameOrigin(req) {
    if (req.headers.origin === origin) return true
    // Development uses either hostname for the same local Vite server.
    return !secure && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin) && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(req.headers.origin)
  }
  async function issueToken(u, purpose) {
    const token = randomBytes(32).toString('hex')
    db.prepare('DELETE FROM account_tokens WHERE user_id=? AND purpose=? OR expires<=?').run(u.id, purpose, Date.now())
    db.prepare('INSERT INTO account_tokens VALUES(?,?,?,?)').run(digest(token), u.id, purpose, Date.now() + 30 * 60000)
    try { await mailer({ to: u.email, subject: purpose === 'reset' ? 'Recuperá tu cuenta Oscal' : 'Confirmá tu correo en Oscal', text: `Abrí este enlace antes de 30 minutos: ${origin}/acceso#${purpose}=${token}\nSi no lo solicitaste, ignorá este mensaje.` }) }
    catch (error) { db.prepare('DELETE FROM account_tokens WHERE token=?').run(digest(token)); throw error }
  }
  async function handle(req, res, path, readBody, reply) {
    if (!path.startsWith('/api/auth/') && path !== '/api/account/orders') return false
    if (req.method !== 'GET' && (!sameOrigin(req) || !req.headers['content-type']?.startsWith('application/json'))) { reply(res, 403, { error: 'Solicitud no autorizada.' }); return true }
    if (path === '/api/auth/session' && req.method === 'GET') { const u = user(req); reply(res, 200, { user: u ? publicUser(u) : null }); return true }
    if (['/api/auth/register', '/api/auth/login'].includes(path) && req.method === 'POST') {
      if (limited(`ip:${clientAddress(req, trustedProxies)}`) || activeHashes >= 4) { reply(res, 429, { error: 'Demasiados intentos. Volvé a probar más tarde.' }); return true }
      const input = await readBody(req)
      const email = emailOf(input.email)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !passwordValid(input.password)) { reply(res, 400, { error: 'Ingresá un correo válido y una contraseña de entre 12 y 128 caracteres.' }); return true }
      if (limited(`email:${digest(email)}`)) { reply(res, 429, { error: 'Demasiados intentos. Volvé a probar más tarde.' }); return true }
      if (activeHashes >= 4) { reply(res, 429, { error: 'Servidor ocupado. Intentá nuevamente.' }); return true }
      activeHashes++
      try {
        let u = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
        if (path.endsWith('/register')) {
          const name = text(input.name, 80)
          if (!name) { reply(res, 400, { error: 'Ingresá tu nombre.' }); return true }
          if (u) { reply(res, 409, { error: 'No pudimos crear la cuenta con esos datos. Si ya tenés cuenta, ingresá.' }); return true }
          const password = await hashPassword(input.password)
          const id = randomUUID()
          // UNIQUE also protects concurrent registration attempts.
          const created = db.prepare('INSERT OR IGNORE INTO users (id,email,name,password,created) VALUES (?,?,?,?,?)').run(id, email, name, password, new Date().toISOString())
          if (!created.changes) { reply(res, 409, { error: 'No pudimos crear la cuenta con esos datos.' }); return true }
          u = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
        } else {
          // Compute the same work for missing accounts to avoid a fast timing oracle.
          const valid = await verifyPassword(input.password, u?.password || `${'0'.repeat(32)}:${'0'.repeat(128)}`)
          if (!u || !valid) { reply(res, 401, { error: 'Correo o contraseña incorrectos.' }); return true }
        }
        setSession(req, res, u.id)
        if (path.endsWith('/register') && mailer) void issueToken(u, 'verify').catch(() => {})
        reply(res, 200, { user: publicUser(u) })
      } finally { activeHashes-- }
      return true
    }
    if (path === '/api/auth/recover' && req.method === 'POST') {
      if (rate(`recover:${clientAddress(req, trustedProxies)}`, 5, 15 * 60000)) { reply(res, 429, { error: 'Esperá antes de volver a intentar.' }); return true }
      if (!mailer) { reply(res, 503, { error: 'La recuperación por correo todavía no está configurada. Contactá al local.' }); return true }
      const input = await readBody(req), email = emailOf(input.email)
      const found = db.prepare('SELECT * FROM users WHERE email=?').get(email)
      reply(res, 200, { message: 'Si existe una cuenta con ese correo, recibirás un enlace para recuperarla.' })
      if (found && !rate(`recover-email:${digest(email)}`, 3, 30 * 60000)) void issueToken(found, 'reset').catch(() => {})
      return true
    }
    if (['/api/auth/reset', '/api/auth/verify'].includes(path) && req.method === 'POST') {
      if (rate(`token:${clientAddress(req, trustedProxies)}`, 15, 15 * 60000)) { reply(res, 429, { error: 'Demasiados intentos.' }); return true }
      const input = await readBody(req), purpose = path.endsWith('/reset') ? 'reset' : 'verify'
      if (!/^[a-f0-9]{64}$/.test(input.token || '')) { reply(res, 400, { error: 'Enlace inválido o vencido.' }); return true }
      const row = db.prepare('SELECT * FROM account_tokens WHERE token=? AND purpose=? AND expires>?').get(digest(input.token), purpose, Date.now())
      if (!row) { reply(res, 400, { error: 'Enlace inválido o vencido.' }); return true }
      let password
      if (purpose === 'reset') {
        if (!passwordValid(input.password)) { reply(res, 400, { error: 'Usá entre 12 y 128 caracteres.' }); return true }
        if (activeHashes >= 4) { reply(res, 429, { error: 'Servidor ocupado.' }); return true }
        activeHashes++
        try { password = await hashPassword(input.password) } finally { activeHashes-- }
      }
      db.exec('BEGIN IMMEDIATE')
      try {
        const consumed = db.prepare('DELETE FROM account_tokens WHERE token=? AND expires>?').run(digest(input.token), Date.now())
        if (!consumed.changes) throw new Error('Enlace inválido o vencido.')
        if (purpose === 'reset') { db.prepare('UPDATE users SET password=? WHERE id=?').run(password, row.user_id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id); db.prepare('DELETE FROM account_tokens WHERE user_id=?').run(row.user_id) }
        else db.prepare('UPDATE users SET verified=1 WHERE id=?').run(row.user_id)
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
      reply(res, 200, { message: purpose === 'reset' ? 'Contraseña actualizada. Volvé a ingresar.' : 'Correo confirmado.' }); return true
    }
    const u = user(req)
    if (!u) { reply(res, 401, { error: 'Ingresá a tu cuenta para continuar.' }); return true }
    if (path === '/api/auth/send-verification' && req.method === 'POST') {
      if (!mailer) { reply(res, 503, { error: 'El servicio de correo todavía no está configurado.' }); return true }
      if (rate(`verify:${u.id}`, 3, 30 * 60000)) { reply(res, 429, { error: 'Esperá antes de volver a intentar.' }); return true }
      if (!u.verified) await issueToken(u, 'verify')
      reply(res, 200, { message: 'Revisá tu correo para confirmar tu cuenta.' }); return true
    }
    if (path === '/api/auth/logout-all' && req.method === 'POST') {
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id)
      reply(res, 200, { user: null }); return true
    }
    if (path === '/api/auth/logout'  && req.method === 'POST') {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(digest(sessionToken(req)))
      res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`)
      reply(res, 200, { user: null }); return true
    }
    if (path === '/api/auth/address' && req.method === 'PUT') {
      const input = await readBody(req)
      const address = { phone: text(input.phone, 40), street: text(input.street, 180), city: text(input.city, 120) }
      db.prepare('UPDATE users SET address = ? WHERE id = ?').run(JSON.stringify(address), u.id)
      reply(res, 200, { user: publicUser({ ...u, address: JSON.stringify(address) }) }); return true
    }
    if (path === '/api/account/orders' && req.method === 'GET') {
      const rows = db.prepare('SELECT orders.id,orders.total,orders.status,orders.created,orders.data FROM orders JOIN order_users ON orders.id = order_users.order_id WHERE order_users.user_id = ? ORDER BY orders.created DESC LIMIT 100').all(u.id)
      reply(res, 200, { orders: rows.map(({ data, ...row }) => ({ ...row, items: JSON.parse(data).items.map(p => ({ title: p.title, quantity: p.quantity })) })) }); return true
    }
    reply(res, 404, { error: 'Ruta no encontrada.' }); return true
  }
  return { user, handle, sameOrigin }
}
