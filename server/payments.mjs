import { createHash, randomUUID } from 'node:crypto'
import { selectedCatalog } from './catalog.mjs'
import { validateOrder, verifiedPayment } from './commerce.mjs'
const hash = value => createHash('sha256').update(value).digest('hex')
export function createPayments(db, { mp, origin, production = false }) {
  db.exec(`CREATE TABLE IF NOT EXISTS checkout_attempts(key TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,order_id TEXT UNIQUE NOT NULL,user_id TEXT NOT NULL,url TEXT,expires INTEGER NOT NULL,released INTEGER NOT NULL DEFAULT 0,settled INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS checkout_active_user ON checkout_attempts(user_id) WHERE released=0 AND settled=0;`)
  async function checkout(input, user) {
    if (!user?.verified) throw new Error('Ingresá y confirmá tu correo antes de pagar online.')
    if (!/^[a-f0-9]{64}$/.test(input?.requestKey || '')) throw new Error('Referencia de compra inválida.')
    const key = hash(input.requestKey), fingerprint = hash(JSON.stringify({ items: input.items, customer: input.customer, user: user.id }))
    const old = db.prepare('SELECT * FROM checkout_attempts WHERE key=?').get(key)
    if (old) {
      if (old.fingerprint !== fingerprint || old.user_id !== user.id) throw new Error('La referencia pertenece a otro pedido.')
      if (old.released || old.settled) throw new Error('Este intento ya finalizó. Consultá tus pedidos.')
      if (!old.url || old.expires <= Date.now()) throw new Error(`Pedido ${old.order_id} en revisión. No se creará otro intento hasta conciliarlo.`)
      return { id: old.order_id, token: input.requestKey, url: old.url }
    }
    const id = randomUUID(), expires = Date.now() + 30 * 60000
    let order
    db.exec('BEGIN IMMEDIATE')
    try {
      if (db.prepare('SELECT 1 FROM checkout_attempts WHERE user_id=? AND released=0 AND settled=0').get(user.id)) throw new Error('Ya tenés un pago pendiente. Consultá tus pedidos antes de iniciar otro.')
      order = validateOrder(input, selectedCatalog(db, input.items?.map(item => item?.id)))
      for (const item of order.items) if (!db.prepare('UPDATE inventory SET available=available-? WHERE id=? AND available>=?').run(item.quantity,item.id,item.quantity).changes) throw new Error('El stock cambió. Revisá el carrito.')
      db.prepare('INSERT INTO orders(id,token,data,total,status,created) VALUES(?,?,?,?,?,?)').run(id,key,JSON.stringify(order),order.total,'pending',new Date().toISOString())
      db.prepare('INSERT INTO order_users VALUES(?,?)').run(id,user.id)
      db.prepare('INSERT INTO checkout_attempts(key,fingerprint,order_id,user_id,expires) VALUES(?,?,?,?,?)').run(key,fingerprint,id,user.id,expires)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    try {
      const preference = await mp('/checkout/preferences', { items: order.items, payer: { name: order.customer.name, email: user.email }, external_reference: id, expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: new Date(expires).toISOString(), back_urls: Object.fromEntries(['success','failure','pending'].map(state => [state,`${origin}/pedido?order=${id}`])), auto_return: 'approved', notification_url: `${origin}/api/payments/webhook`, statement_descriptor: 'OSCAL' }, 'POST', key)
      if (!/^https:\/\/([\w-]+\.)*mercadopago\.(com|com\.uy)\//.test(preference.init_point || '')) throw new Error('Enlace de pago inválido.')
      db.exec('BEGIN IMMEDIATE')
      try { db.prepare('UPDATE orders SET preference=? WHERE id=?').run(String(preference.id),id); db.prepare('UPDATE checkout_attempts SET url=? WHERE key=?').run(preference.init_point,key); db.exec('COMMIT') } catch (error) { db.exec('ROLLBACK'); throw error }
      return { id, token: input.requestKey, url: preference.init_point }
    } catch {
      db.prepare("UPDATE orders SET status='needs_review' WHERE id=?").run(id)
      throw new Error(`Pago ${id} en revisión. Consultá al local antes de reintentar.`)
    }
  }
  async function reconcile(paymentId, expectedId) {
    if (!/^\d{1,30}$/.test(String(paymentId))) throw new Error('Referencia de pago inválida.')
    const payment = await mp(`/v1/payments/${paymentId}`)
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(String(payment.external_reference))
    if (!order || expectedId && order.id !== expectedId || !verifiedPayment(payment,order) || payment.live_mode !== production) throw new Error('El pago no coincide con el pedido o el entorno.')
    const attempt = db.prepare('SELECT * FROM checkout_attempts WHERE order_id=?').get(order.id)
    if (attempt?.released) { db.prepare("UPDATE orders SET status='needs_review' WHERE id=?").run(order.id); return }
    if (order.payment && order.payment !== String(payment.id) && ['approved','refunded','charged_back'].includes(order.status)) return
    if (!['approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back'].includes(payment.status)) throw new Error('Estado de pago desconocido.')
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('UPDATE orders SET status=?,payment=? WHERE id=?').run(payment.status,String(payment.id),order.id)
      if (['approved','refunded','charged_back'].includes(payment.status)) db.prepare('UPDATE checkout_attempts SET settled=1 WHERE order_id=?').run(order.id)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  // Operator-only CLI. Never release on age alone: preference and ALL attempts are checked with MP.
  async function closeReservation(id) {
    const attempt = db.prepare('SELECT * FROM checkout_attempts WHERE order_id=?').get(id)
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(id)
    if (!attempt || !order || attempt.released || attempt.settled) throw new Error('No hay una reserva abierta para liberar.')
    if (!order.preference || attempt.expires + 24 * 3600000 > Date.now()) throw new Error('Reserva ambigua o reciente: requiere conciliación; no se libera.')
    const preference = await mp(`/checkout/preferences/${encodeURIComponent(order.preference)}`)
    if (preference.external_reference !== id || preference.expires !== true || !Number.isFinite(Date.parse(preference.expiration_date_to)) || Date.parse(preference.expiration_date_to) + 24 * 3600000 > Date.now()) throw new Error('La preferencia no está confirmada como vencida.')
    const payments = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(id)}&limit=100&offset=0`)
    if (!Array.isArray(payments.results) || !Number.isInteger(payments.paging?.total) || payments.paging.total !== payments.results.length) throw new Error('Búsqueda de pagos incompleta. No se libera stock.')
    if (payments.results.some(p => String(p.external_reference) !== id || p.live_mode !== production || !['rejected','cancelled'].includes(p.status))) throw new Error('Existen pagos pendientes/aprobados o estados ambiguos. No se libera stock.')
    db.exec('BEGIN IMMEDIATE')
    try {
      if (!db.prepare('UPDATE checkout_attempts SET released=1 WHERE order_id=? AND released=0 AND settled=0').run(id).changes) throw new Error('La reserva cambió durante la conciliación.')
      for (const item of JSON.parse(order.data).items) db.prepare('UPDATE inventory SET available=available+? WHERE id=?').run(item.quantity,item.id)
      db.prepare("UPDATE orders SET status='cancelled' WHERE id=? AND status NOT IN ('approved','refunded','charged_back')").run(id)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
  }
  async function maintenance() {
    const rows=db.prepare('SELECT a.order_id FROM checkout_attempts a JOIN orders o ON o.id=a.order_id WHERE a.released=0 AND a.settled=0 AND a.expires<? AND o.preference IS NOT NULL LIMIT 10').all(Date.now()-24*3600000)
    for (const row of rows) {
      try { await closeReservation(row.order_id) }
      catch { /* Pending/ambiguous payments remain held and are visible to the operator. */ }
    }
  }
  return { checkout, reconcile, closeReservation, maintenance }
}
