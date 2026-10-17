import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { initializeCatalog, readCatalog, importCatalog } from './catalog.mjs';
import { submitOrder } from './orders.mjs';
const seed = JSON.parse(readFileSync(new URL('../shared/catalog.json', import.meta.url), 'utf8'));
async function fixture(t) {
    const db = new DatabaseSync(':memory:');
    t.after(async () => await db.close());
    await db.exec('CREATE TABLE orders(id TEXT PRIMARY KEY, token TEXT, data TEXT, total INTEGER, status TEXT, created TEXT); CREATE TABLE order_users(order_id TEXT PRIMARY KEY,user_id TEXT)');
    await initializeCatalog(db, seed);
    return db;
}
const request = () => ({ requestKey: 'ab'.repeat(32), items: [{ id: 'OSC-001', quantity: 2 }], customer: { name: 'Prueba', email: 'test@example.com', phone: '099000000', delivery: 'pickup' } });
test('catalog migrates once, keeps existing inventory and imports without resetting stock', async (t) => {
    const db = await fixture(t);
    const product = (await readCatalog(db)).products[0];
    await db.prepare('UPDATE inventory SET available=3 WHERE id=?').run(product.id);
    await initializeCatalog(db, seed);
    await importCatalog(db, seed);
    assert.equal((await readCatalog(db)).products[0].stock, 3);
    assert.equal((await readCatalog(db)).products.length, 8);
});
test('invalid imports roll back; draft products stay private and replacement hides demos', async (t) => {
    const db = await fixture(t);
    await assert.rejects(async () => await importCatalog(db, { ...seed, products: [...seed.products, seed.products[0]] }));
    assert.equal((await readCatalog(db)).products.length, 8);
    const real = { demo: false, currency: 'UYU', products: [{ ...seed.products[0], id: 'REAL-1', published: false, sourcePage: 2 }] };
    await assert.rejects(async () => await importCatalog(db, real, { replace: true }));
    assert.equal((await readCatalog(db)).demo, true);
    assert.equal((await readCatalog(db)).products.length, 8);
    await importCatalog(db, real, { replace: true, resetStock: true });
    assert.deepEqual(await readCatalog(db), { demo: false, currency: 'UYU', products: [] });
});
test('guest order is persisted, repriced server-side and retry is idempotent', async (t) => {
    const db = await fixture(t), catalog = await readCatalog(db), input = request();
    input.items[0].id = catalog.products[0].id;
    input.items[0].price = 1;
    const saved = await submitOrder(db, input, catalog);
    assert.deepEqual(await submitOrder(db, input, catalog), saved);
    const row = await db.prepare('SELECT * FROM orders').get();
    assert.equal(row.total, catalog.products[0].price * 2);
    assert.equal(row.status, 'demo');
    assert.notEqual(row.token, saved.token);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM orders').get()).n, 1);
    assert.equal((await readCatalog(db)).products[0].stock, catalog.products[0].stock);
    await assert.rejects(async () => await submitOrder(db, { ...input, items: [{ id: input.items[0].id, quantity: 1 }] }, catalog));
    await importCatalog(db, { ...seed, products: seed.products.map(p => ({ ...p, price: p.price + 100 })) });
    assert.equal((await db.prepare('SELECT total FROM orders').get()).total, row.total);
});
test('delivery requests validate address and remain unpaid without stock reservation', async (t) => {
    const db = await fixture(t);
    await importCatalog(db, { ...seed, demo: false, products: seed.products.map(p => ({ ...p, published: true })) }, { replace: true, resetStock: true });
    const catalog = await readCatalog(db), input = request();
    input.items[0].id = catalog.products[0].id;
    input.customer.delivery = 'delivery';
    await assert.rejects(async () => await submitOrder(db, input, catalog));
    input.customer.address = 'Calle 123';
    input.customer.city = 'Montevideo';
    const saved = await submitOrder(db, input, catalog, 'owner');
    assert.equal(saved.status, 'awaiting_shipping');
    assert.equal((await db.prepare('SELECT user_id FROM order_users').get()).user_id, 'owner');
    assert.equal((await readCatalog(db)).products[0].stock, catalog.products[0].stock);
});
