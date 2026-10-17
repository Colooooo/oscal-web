import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { PostgresDatabase, SqliteDatabase } from './database.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canCharge } from './commerce.mjs';
import { createAuth } from './auth.mjs';
import { initializeCatalog, catalogMode, selectedCatalog, catalogPage } from './catalog.mjs';
import { submitOrder } from './orders.mjs';
import { createPayments } from './payments.mjs';
import { createMailer } from './mail.mjs';
import { createLimiter, clientAddress, verifyWebhook, setSecurityHeaders, readBody } from './security.mjs';
import { staticHandler } from './static.mjs';
import { applicationOrigin } from './runtime.mjs';
export async function openDatabase(env = process.env) {
    if (env.DATABASE_URL) {
        const db = new PostgresDatabase(env.DATABASE_URL);
        try {
            await db.prepare('SELECT 1').get();
            return db;
        }
        catch (error) {
            await db.close();
            throw error;
        }
    }
    if (env.VERCEL === '1')
        throw new Error('Configurá DATABASE_URL de Neon en Vercel.');
    const directory = env.OSCAL_DATA_DIR || fileURLToPath(new URL('./data', import.meta.url));
    mkdirSync(directory, { recursive: true });
    const db = new SqliteDatabase(resolve(directory, 'orders.sqlite'));
    await db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,token TEXT NOT NULL,data TEXT NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL,preference TEXT,payment TEXT,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS inventory(id TEXT PRIMARY KEY,available INTEGER NOT NULL CHECK(available>=0));');
    await initializeCatalog(db, JSON.parse(readFileSync(new URL('../shared/catalog.json', import.meta.url), 'utf8')));
    return db;
}
export async function createHandler({ db, env = process.env, mp: override, mailer = createMailer(env), staticRoot = resolve('dist'), serveStatic = false, background }) {
    const origin = applicationOrigin(env);
    const vercel = env.VERCEL === '1';
    const trustedProxies = (env.TRUSTED_PROXIES || '').split(',').map(x => x.trim()).filter(Boolean);
    if (origin.startsWith('https://') && !trustedProxies.length && !vercel)
        throw new Error('Configurá TRUSTED_PROXIES y la cabecera X-Real-IP del proxy HTTPS antes de iniciar.');
    if (env.NODE_ENV === 'production' && !origin.startsWith('https://'))
        throw new Error('Producción requiere PUBLIC_URL con HTTPS.');
    const rate = await createLimiter(db), auth = await createAuth(db, { origin, trustedProxies, mailer, vercel, background });
    let mpActive = 0;
    async function mp(path, body, method = body ? 'POST' : 'GET', idempotency) {
        if (mpActive >= 4)
            throw new Error('Proveedor ocupado. Intentá nuevamente.');
        mpActive++;
        try {
            if (override)
                return await override(path, body, method, idempotency);
            const response = await fetch(`https://api.mercadopago.com${path}`, { method, headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(idempotency ? { 'X-Idempotency-Key': idempotency } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
            if (!response.ok)
                throw new Error('Mercado Pago no está disponible.');
            return await response.json();
        }
        finally {
            mpActive--;
        }
    }
    const payments = await createPayments(db, { mp, origin, production: env.MERCADOPAGO_MODE === 'production' });
    const serve = serveStatic ? staticHandler(staticRoot) : null, pages = new Map(), notifications = new Map();
    let revision = '';
    const reply = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    const handler = async (req, res) => {
        setSecurityHeaders(res, origin.startsWith('https://'));
        try {
            const url = new URL(req.url, origin), address = clientAddress(req, trustedProxies, vercel);
            if (!url.pathname.startsWith('/api/'))
                return serve ? await serve(req, res, url) : reply(res, 404, { error: 'Ruta no encontrada.' });
            if (await rate(`api:${address}`, 300, 60000) || await rate('api:global', 10000, 60000))
                return reply(res, 429, { error: 'Demasiadas solicitudes. Esperá un momento.' });
            if (await auth.handle(req, res, url.pathname, readBody, reply))
                return;
            if (url.pathname === '/api/catalog/selection' && req.method === 'GET')
                return reply(res, 200, await selectedCatalog(db, (url.searchParams.get('ids') || '').split(',').slice(0, 100)));
            if (url.pathname === '/api/catalog' && req.method === 'GET') {
                const version = (await db.prepare('SELECT version FROM catalog_revision WHERE id=1').get()).version;
                if (revision !== version) {
                    pages.clear();
                    revision = version;
                }
                const key = url.searchParams.toString();
                let page = pages.get(key);
                if (!page || page.until < Date.now()) {
                    const value = await catalogPage(db, url.searchParams), json = JSON.stringify(value);
                    page = { json, etag: '"' + createHash('sha256').update(json).digest('hex') + '"', until: Date.now() + 10000 };
                    if (pages.size >= 32)
                        pages.clear();
                    pages.set(key, page);
                }
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                res.setHeader('ETag', page.etag);
                if (req.headers['if-none-match'] === page.etag) {
                    res.writeHead(304);
                    return res.end();
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(page.json);
            }
            const mode = async () => ({ demo: await catalogMode(db) });
            if (url.pathname === '/api/payments/config' && req.method === 'GET')
                return reply(res, 200, { enabled: canCharge(await mode(), env), demo: await catalogMode(db) });
            if (['/api/orders', '/api/checkout'].includes(url.pathname) && req.method === 'POST') {
                if (!auth.sameOrigin(req) || !req.headers['content-type']?.startsWith('application/json'))
                    return reply(res, 403, { error: 'Solicitud no autorizada.' });
                if (await rate(`orders:${address}`, 10, 60000))
                    return reply(res, 429, { error: 'Esperá un minuto antes de volver a intentar.' });
                const input = await readBody(req), user = await auth.user(req);
                if (url.pathname === '/api/orders')
                    return reply(res, 201, await submitOrder(db, input, await selectedCatalog(db, Array.isArray(input.items) ? input.items.map(x => x?.id) : []), user?.id));
                if (!canCharge(await mode(), env))
                    return reply(res, 503, { error: 'Los pagos todavía no están habilitados. No se realizó ningún cobro.' });
                return reply(res, 200, await payments.checkout(input, user));
            }
            if (url.pathname === '/api/payments/webhook' && req.method === 'POST') {
                if (!canCharge(await mode(), env))
                    return reply(res, 503, { error: 'Pagos desactivados.' });
                const id = url.searchParams.get('data.id');
                if (!verifyWebhook(req, id, env.MERCADOPAGO_WEBHOOK_SECRET))
                    return reply(res, 401, { error: 'Firma inválida.' });
                if (await rate('webhook:global', 120, 60000))
                    return reply(res, 429, { error: 'Esperá un momento.' });
                const notification = await readBody(req);
                if (notification.type !== 'payment' || String(notification.data?.id) !== id)
                    return reply(res, 400, { error: 'Notificación inválida.' });
                for (const [key, value] of notifications)
                    if (value.until < Date.now())
                        notifications.delete(key);
                let entry = notifications.get(id);
                if (!entry) {
                    entry = { until: Date.now() + 5000, promise: payments.reconcile(id) };
                    notifications.set(id, entry);
                }
                try {
                    await entry.promise;
                }
                catch (error) {
                    notifications.delete(id);
                    throw error;
                }
                return reply(res, 200, { received: true });
            }
            const match = url.pathname.match(/^\/api\/orders\/([a-f0-9-]{36})$/);
            if (match && req.method === 'GET') {
                const order = await db.prepare('SELECT * FROM orders WHERE id=?').get(match[1]), user = await auth.user(req);
                const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
                const owner = user && await db.prepare('SELECT 1 FROM order_users WHERE order_id=? AND user_id=?').get(match[1], user.id);
                if (!order || !owner && createHash('sha256').update(token).digest('hex') !== order.token)
                    return reply(res, 404, { error: 'Pedido no encontrado.' });
                const paymentId = url.searchParams.get('payment_id') || order.payment;
                if (paymentId && canCharge(await mode(), env) && order.status !== 'demo') {
                    if (await rate(`verify:${order.id}`, 6, 60000))
                        return reply(res, 429, { error: 'Esperá antes de volver a consultar.' });
                    await payments.reconcile(paymentId, order.id);
                }
                return reply(res, 200, { id: order.id, total: order.total, status: (await db.prepare('SELECT status FROM orders WHERE id=?').get(order.id)).status });
            }
            return reply(res, 404, { error: 'Ruta no encontrada.' });
        }
        catch (error) {
            if (!res.headersSent && !res.destroyed)
                reply(res, error.status || 400, { error: error.code || error.message?.startsWith('SQLITE') ? 'No se pudo procesar la solicitud.' : error.message || 'Solicitud inválida.' });
            else
                res.destroy();
        }
    };
    return { handler, payments };
}
export async function createApp(options) {
    const { db, env = process.env } = options;
    const { handler, payments } = await createHandler({ ...options, serveStatic: true });
    const server = createServer(handler);
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    server.keepAliveTimeout = 5000;
    server.maxRequestsPerSocket = 100;
    server.maxConnections = 128;
    let maintaining = false;
    const maintenance = setInterval(async () => {
        if (maintaining)
            return;
        maintaining = true;
        try {
            if (canCharge({ demo: await catalogMode(db) }, env))
                await payments.maintenance();
        }
        catch { /* Next cycle retries; never release on errors. */ }
        finally {
            maintaining = false;
        }
    }, 10 * 60000);
    maintenance.unref();
    server.on('close', () => clearInterval(maintenance));
    return { server, payments };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const db = await openDatabase(), { server } = await createApp({ db });
    server.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('Oscal API ready on port ' + server.address().port));
    const stop = () => server.close(async () => { await db.close(); });
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}
