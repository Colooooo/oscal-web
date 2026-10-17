import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
const normalize = ip => ip?.replace(/^::ffff:/, '');
export function clientAddress(req, trusted = [], vercel = false) {
    if (vercel) {
        const forwarded = req.headers['x-vercel-forwarded-for'];
        return typeof forwarded === 'string' && isIP(forwarded) ? normalize(forwarded) : 'unknown';
    }
    const peer = normalize(req.socket.remoteAddress) || 'unknown';
    if (!trusted.map(normalize).includes(peer))
        return peer;
    // The trusted edge must overwrite X-Real-IP. Never accept an arbitrary X-Forwarded-For chain.
    const forwarded = req.headers['x-real-ip'];
    return typeof forwarded === 'string' && isIP(forwarded) ? normalize(forwarded) : peer;
}
export async function createLimiter(db) {
    await db.exec('CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires)');
    const update = db.prepare('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires<=? THEN 1 ELSE rate_limits.count+1 END,expires=CASE WHEN rate_limits.expires<=? THEN excluded.expires ELSE rate_limits.expires END RETURNING count');
    let lastCleanup = 0;
    return async (key, max, windowMs) => {
        const now = Date.now();
        if (now - lastCleanup > 60000) {
            await db.prepare('DELETE FROM rate_limits WHERE expires<=?').run(now);
            lastCleanup = now;
        }
        const digest = createHash('sha256').update(key).digest('hex');
        return (await update.get(digest, now + windowMs, now, now)).count > max;
    };
}
export function verifyWebhook(req, id, secret, now = Date.now()) {
    if (!secret || !/^[a-zA-Z0-9-]{1,100}$/.test(String(id)))
        return false;
    const signature = req.headers['x-signature'], requestId = req.headers['x-request-id'];
    if (typeof signature !== 'string' || typeof requestId !== 'string' || !/^[\w-]{1,150}$/.test(requestId))
        return false;
    const parts = Object.fromEntries(signature.split(',').map(part => part.trim().split('=')));
    if (!/^\d{10,13}$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || ''))
        return false;
    const timestamp = Number(parts.ts) * (parts.ts.length === 10 ? 1000 : 1);
    if (Math.abs(now - timestamp) > 5 * 60000)
        return false;
    const expected = createHmac('sha256', secret).update(`id:${String(id).toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest();
    return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
}
export function setSecurityHeaders(res, secure) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    if (secure)
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
}
let bodies = 0;
export async function readBody(req) {
    if (bodies >= 32)
        throw Object.assign(new Error('Servidor ocupado.'), { status: 429 });
    bodies++;
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => req.destroy(), 10000);
    try {
        // Vercel's Node runtime may have already parsed and consumed the stream.
        if (req.body !== undefined) {
            const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
            if (body.length > 20000) throw Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 });
            return JSON.parse(body.toString('utf8') || '{}');
        }
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 20000)
                throw Object.assign(new Error('Solicitud demasiado grande.'), { status: 413 });
            chunks.push(chunk);
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    }
    finally {
        clearTimeout(timer);
        bodies--;
    }
}
