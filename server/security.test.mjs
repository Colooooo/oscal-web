import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import { createAuth } from './auth.mjs';
import { clientAddress, createLimiter, verifyWebhook } from './security.mjs';
test('proxy identity trusts only explicitly configured peers and a single valid IP', () => {
    const req = { socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-real-ip': '192.0.2.1', 'x-forwarded-for': 'spoofed' } };
    assert.equal(clientAddress(req), '127.0.0.1');
    assert.equal(clientAddress(req, ['127.0.0.1']), '192.0.2.1');
    req.headers['x-real-ip'] = '192.0.2.1,192.0.2.2';
    assert.equal(clientAddress(req, ['127.0.0.1']), '127.0.0.1');
});
test('SQLite rate limits survive new limiter instances and isolate client keys', async () => {
    const db = new DatabaseSync(':memory:');
    const first = await createLimiter(db);
    assert.equal(await first('client1', 1, 60000), false);
    assert.equal(await (await createLimiter(db))('client1', 1, 60000), true);
    assert.equal(await first('client2', 1, 60000), false);
    await db.close();
});
test('delayed bodies cannot bypass the four-hash concurrency limit', async () => {
    const db = new DatabaseSync(':memory:'), auth = await createAuth(db, { origin: 'https://audit.example' });
    let release;
    const barrier = new Promise(resolve => { release = resolve; }), statuses = [];
    const calls = Array.from({ length: 5 }, (_, i) => auth.handle({ method: 'POST', headers: { origin: 'https://audit.example', 'content-type': 'application/json' }, socket: { remoteAddress: `audit-${i}` } }, { setHeader() { } }, '/api/auth/register', async () => { await barrier; return { name: 'Fixture', email: `test${i}@example.com`, password: 'isolated long password' }; }, (_res, status) => statuses.push(status)));
    release();
    await Promise.all(calls);
    assert.equal(statuses.filter(s => s === 200).length, 4);
    assert.equal(statuses.filter(s => s === 429).length, 1);
    await db.close();
});
test('webhooks require exact HMAC, request identity and a recent timestamp', () => {
    const now = Date.now(), ts = String(Math.floor(now / 1000)), secret = 'fixture-secret', id = '123', request = 'test-req';
    const signature = createHmac('sha256', secret).update(`id:${id};request-id:${request};ts:${ts};`).digest('hex');
    const req = { headers: { 'x-request-id': request, 'x-signature': `ts=${ts},v1=${signature}` } };
    assert.equal(verifyWebhook(req, id, secret, now), true);
    assert.equal(verifyWebhook(req, '124', secret, now), false);
    assert.equal(verifyWebhook(req, id, 'wrong', now), false);
    assert.equal(verifyWebhook(req, id, secret, now + 6 * 60000), false);
    req.headers['x-signature'] = `ts=${ts},v1=bad`;
    assert.equal(verifyWebhook(req, id, secret, now), false);
});
test('recovery links are single-use and password reset revokes every session', async () => {
    const db = new DatabaseSync(':memory:'), mail = [];
    const auth = await createAuth(db, { origin: 'https://audit.example', mailer: async (message) => { mail.push(message); } });
    async function call(path, input = {}, cookie = '') {
        const result = { headers: {} };
        await auth.handle({ method: 'POST', headers: { origin: 'https://audit.example', 'content-type': 'application/json', cookie }, socket: { remoteAddress: 'test' } }, { setHeader(k, v) { result.headers[k] = v; } }, '/api/auth/' + path, async () => input, (_res, status, body) => Object.assign(result, { status, body }));
        return result;
    }
    const profile = { name: 'Fixture', email: 'recovery@example.com', password: 'long test password' };
    await call('register', profile);
    const verify = mail[0].text.match(/verify=([a-f0-9]{64})/)[1];
    assert.equal((await call('verify', { token: verify })).status, 200);
    assert.equal((await call('verify', { token: verify })).status, 400);
    await call('login', profile);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM sessions').get()).n, 2);
    await call('recover', { email: profile.email });
    const token = mail.at(-1).text.match(/reset=([a-f0-9]{64})/)[1];
    assert.equal((await call('reset', { token, password: 'new long test password' })).status, 200);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM sessions').get()).n, 0);
    assert.equal((await call('reset', { token, password: 'another long password' })).status, 400);
    assert.equal((await call('login', profile)).status, 401);
    assert.equal((await call('login', { ...profile, password: 'new long test password' })).status, 200);
    await db.close();
});
