import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { PostgresDatabase, transaction } from './database.mjs';
import { createAuth } from './auth.mjs';
import { createLimiter } from './security.mjs';
import { importCatalog, catalogPage, selectedCatalog } from './catalog.mjs';
import { submitOrder } from './orders.mjs';
import { createPayments } from './payments.mjs';
import { createApp } from './index.mjs';
test('PostgreSQL: accounts, ownership, idempotency, stock and rollback', { skip: !process.env.OSCAL_TEST_DATABASE_URL }, async () => {
    const db = new PostgresDatabase(process.env.OSCAL_TEST_DATABASE_URL);
    const rollback = new Error('Rollback de todos los datos de prueba');
    const email = `${randomUUID()}@example.com`;
    try {
        await assert.rejects(transaction(db, async () => {
            const auth = await createAuth(db, { origin: 'http://localhost:5173' });
            async function call(path, method = 'POST', input = {}, cookie = '') {
                const result = { headers: {} };
                await auth.handle({ method, headers: { cookie, origin: 'http://localhost:5173', 'content-type': 'application/json' }, socket: { remoteAddress: 'test-postgres' } }, { setHeader(k, v) { result.headers[k] = v; } }, path, async () => input, (_res, status, body) => Object.assign(result, { status, body }));
                return result;
            }
            const profile = { name: 'Prueba PostgreSQL', email, password: randomBytes(24).toString('hex') };
            const created = await call('/api/auth/register', 'POST', profile);
            assert.equal(created.status, 200);
            const cookie = created.headers['Set-Cookie'].split(';')[0];
            assert.equal((await call('/api/auth/session', 'GET', {}, cookie)).body.user.id, created.body.user.id);
            assert.equal((await call('/api/auth/login', 'POST', profile)).status, 200);
            assert.equal((await call('/api/auth/address', 'PUT', { street: 'Prueba 123', city: 'Montevideo' }, cookie)).body.user.address.street, 'Prueba 123');
            const limiter = await createLimiter(db), key = randomUUID();
            assert.equal(await limiter(key, 1, 60000), false);
            assert.equal(await limiter(key, 1, 60000), true);
            const product = { id: `TEST-${randomUUID()}`, name: 'Cerámica', category: 'Bazar', description: 'Prueba', price: 100, stock: 10, published: true };
            await importCatalog(db, { demo: true, currency: 'UYU', products: [product] }, { replace: true, resetStock: true });
            assert.equal((await catalogPage(db, new URLSearchParams('q=ceramica&categoria=Bazar&orden=menor'))).products[0].id, product.id);
            assert.equal((await catalogPage(db, new URLSearchParams('q=%'))).total, 0);
            const catalog = await selectedCatalog(db, [product.id]);
            const { server } = await createApp({ db, env: { PUBLIC_URL: 'http://localhost:5173', PAYMENTS_ENABLED: 'false' } });
            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            try {
                const base = `http://127.0.0.1:${server.address().port}`;
                const response = await fetch(base + '/api/catalog?q=ceramica', { signal: AbortSignal.timeout(10000) });
                assert.equal(response.status, 200);
                assert.equal((await response.json()).products[0].id, product.id);
                assert.equal((await (await fetch(base + '/api/auth/session')).json()).user, null);
                assert.equal((await (await fetch(base + '/api/payments/config')).json()).enabled, false);
            }
            finally {
                await new Promise(resolve => server.close(resolve));
            }
            const input = { requestKey: randomBytes(32).toString('hex'), items: [{ id: product.id, quantity: 2 }], customer: { name: 'Prueba', email, phone: '099000000', delivery: 'pickup' } };
            const order = await submitOrder(db, input, catalog, created.body.user.id);
            assert.deepEqual(await submitOrder(db, input, catalog, created.body.user.id), order);
            assert.equal((await call('/api/account/orders', 'GET', {}, cookie)).body.orders[0].id, order.id);
            assert.equal((await call('/api/account/orders', 'GET')).status, 401);
            await importCatalog(db, { demo: false, currency: 'UYU', products: [product] }, { replace: true, resetStock: true });
            const payments = await createPayments(db, { origin: 'http://localhost:5173', mp: async () => ({ id: 'fixture', init_point: 'https://www.mercadopago.com.uy/checkout/test' }) });
            const purchase = { ...input, requestKey: randomBytes(32).toString('hex') };
            const user = { ...created.body.user, verified: true };
            const paid = await payments.checkout(purchase, user);
            assert.deepEqual(await payments.checkout(purchase, user), paid);
            assert.equal((await db.prepare('SELECT available FROM inventory WHERE id=?').get(product.id)).available, 8);
            await assert.rejects(payments.checkout({ ...purchase, requestKey: randomBytes(32).toString('hex') }, user), /pendiente/);
            await call('/api/auth/logout-all', 'POST', {}, cookie);
            assert.equal((await call('/api/auth/session', 'GET', {}, cookie)).body.user, null);
            throw rollback;
        }), error => error === rollback);
        assert.equal(await db.prepare('SELECT id FROM users WHERE email=?').get(email), undefined);
    }
    finally {
        await db.close();
    }
});
