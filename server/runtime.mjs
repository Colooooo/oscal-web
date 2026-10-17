export function applicationOrigin(env) {
    const vercel = env.VERCEL === '1';
    const preview = vercel && env.VERCEL_ENV === 'preview';
    const automatic = preview ? env.VERCEL_URL : env.VERCEL_PROJECT_PRODUCTION_URL;
    const value = preview ? automatic && `https://${automatic}`
        : env.PUBLIC_URL || (vercel && automatic ? `https://${automatic}` : 'http://localhost:5173');
    if (!value) throw new Error('Falta el dominio del entorno de Vercel.');
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
        throw new Error('PUBLIC_URL debe ser el origen de la web, sin rutas ni parámetros.');
    if ((vercel || env.NODE_ENV === 'production') && url.protocol !== 'https:')
        throw new Error('Producción requiere PUBLIC_URL con HTTPS.');
    return url.origin;
}

// One initialization per warm function. A failed connection can recover on retry.
export function createVercelHandler({ env, connect, create, attachPool, background, log = console.error }) {
    let initialization;
    async function initialize() {
        if (!env.DATABASE_URL) throw new Error('DATABASE_URL no configurada.');
        const db = await connect(env);
        try {
            attachPool(db.pool);
            return await create({ db, env: { ...env, VERCEL: '1' }, background });
        } catch (error) { await db.close(); throw error; }
    }
    return async (req, res) => {
        try {
            initialization ||= initialize().catch(error => { initialization = undefined; throw error; });
            const { handler } = await initialization;
            await handler(req, res);
        } catch {
            log('No se pudo iniciar la API de Oscal. Revisá DATABASE_URL, PUBLIC_URL y las migraciones.');
            if (!res.headersSent && !res.destroyed) {
                res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '10' });
                res.end(JSON.stringify({ error: 'El servicio está temporalmente no disponible. Volvé a intentar.' }));
            } else if (!res.destroyed) res.destroy();
        }
    };
}
