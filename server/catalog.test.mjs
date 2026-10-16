import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { initializeCatalog, readCatalog, importCatalog } from './catalog.mjs'
import { submitOrder } from './orders.mjs'
const seed = JSON.parse(readFileSync(new URL('../shared/catalog.json', import.meta.url), 'utf8'))
function fixture(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec('CREATE TABLE orders(id TEXT PRIMARY KEY, token TEXT, data TEXT, total INTEGER, status TEXT, created TEXT); CREATE TABLE order_users(order_id TEXT PRIMARY KEY,user_id TEXT)')
  initializeCatalog(db, seed)
  return db
}
const request = () => ({ requestKey: 'ab'.repeat(32), items: [{ id: 'OSC-001', quantity: 2 }], customer: { name: 'Prueba', email: 'test@example.com', phone: '099000000', delivery: 'pickup' } })

test('catalog migrates once, keeps existing inventory and imports without resetting stock', t => {
  const db = fixture(t)
  const product = readCatalog(db).products[0]
  db.prepare('UPDATE inventory SET available=3 WHERE id=?').run(product.id)
  initializeCatalog(db, seed)
  importCatalog(db, seed)
  assert.equal(readCatalog(db).products[0].stock, 3)
  assert.equal(readCatalog(db).products.length, 8)
})
test('invalid imports roll back; draft products stay private and replacement hides demos', t => {
  const db = fixture(t)
  assert.throws(() => importCatalog(db, { ...seed, products: [...seed.products, seed.products[0]] }))
  assert.equal(readCatalog(db).products.length, 8)
  const real = { demo: false, currency: 'UYU', products: [{ ...seed.products[0], id: 'REAL-1', published: false, sourcePage: 2 }] }
  assert.throws(() => importCatalog(db, real, { replace: true }))
  assert.equal(readCatalog(db).demo, true)
  assert.equal(readCatalog(db).products.length, 8)
  importCatalog(db, real, { replace: true, resetStock: true })
  assert.deepEqual(readCatalog(db), { demo: false, currency: 'UYU', products: [] })
})
test('guest order is persisted, repriced server-side and retry is idempotent', t => {
  const db = fixture(t), catalog = readCatalog(db), input = request()
  input.items[0].id = catalog.products[0].id
  input.items[0].price = 1
  const saved = submitOrder(db, input, catalog)
  assert.deepEqual(submitOrder(db, input, catalog), saved)
  const row = db.prepare('SELECT * FROM orders').get()
  assert.equal(row.total, catalog.products[0].price * 2)
  assert.equal(row.status, 'demo')
  assert.notEqual(row.token, saved.token)
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n, 1)
  assert.equal(readCatalog(db).products[0].stock, catalog.products[0].stock)
  assert.throws(() => submitOrder(db, { ...input, items: [{ id: input.items[0].id, quantity: 1 }] }, catalog))
  importCatalog(db, { ...seed, products: seed.products.map(p => ({ ...p, price: p.price + 100 })) })
  assert.equal(db.prepare('SELECT total FROM orders').get().total, row.total)
})
test('delivery requests validate address and remain unpaid without stock reservation', t => {
  const db = fixture(t)
  importCatalog(db, { ...seed, demo: false, products: seed.products.map(p => ({ ...p, published: true })) }, { replace: true, resetStock: true })
  const catalog = readCatalog(db), input = request()
  input.items[0].id = catalog.products[0].id
  input.customer.delivery = 'delivery'
  assert.throws(() => submitOrder(db, input, catalog))
  input.customer.address = 'Calle 123'; input.customer.city = 'Montevideo'
  const saved = submitOrder(db, input, catalog, 'owner')
  assert.equal(saved.status, 'awaiting_shipping')
  assert.equal(db.prepare('SELECT user_id FROM order_users').get().user_id, 'owner')
  assert.equal(readCatalog(db).products[0].stock, catalog.products[0].stock)
})
