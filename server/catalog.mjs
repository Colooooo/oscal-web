import { transaction, jsonField, productOrder } from './database.mjs';
// The database is the source of truth. The JSON file is only a first-run demo seed.
export async function initializeCatalog(db, seed) {
    if (db.dialect !== 'postgres') {
        await db.exec(`CREATE TABLE IF NOT EXISTS catalog_settings (id INTEGER PRIMARY KEY CHECK(id=1), demo INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, available INTEGER NOT NULL CHECK(available>=0));
    CREATE TABLE IF NOT EXISTS catalog_imports (id INTEGER PRIMARY KEY, source TEXT NOT NULL, count INTEGER NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_requests (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, order_id TEXT NOT NULL);`);
        if (!(await db.prepare('PRAGMA table_info(products)').all()).some(c => c.name === 'search')) {
            await db.exec("ALTER TABLE products ADD COLUMN search TEXT NOT NULL DEFAULT ''");
            for (const row of await db.prepare('SELECT id,data FROM products').all()) {
                const p = JSON.parse(row.data);
                await db.prepare('UPDATE products SET search=? WHERE id=?').run(normalize(`${p.name} ${p.category} ${p.id}`), row.id);
            }
        }
        await db.exec("CREATE INDEX IF NOT EXISTS products_category ON products(published,json_extract(data,'$.category')); CREATE INDEX IF NOT EXISTS products_price ON products(published,json_extract(data,'$.price'))");
        await db.exec('CREATE TABLE IF NOT EXISTS catalog_revision(id INTEGER PRIMARY KEY,version INTEGER NOT NULL); INSERT OR IGNORE INTO catalog_revision VALUES(1,0)');
        for (const table of ['products', 'inventory', 'catalog_settings'])
            for (const event of ['INSERT', 'UPDATE', 'DELETE'])
                await db.exec(`CREATE TRIGGER IF NOT EXISTS revision_${table}_${event} AFTER ${event} ON ${table} BEGIN UPDATE catalog_revision SET version=version+1 WHERE id=1; END`);
    }
    if (!await db.prepare('SELECT 1 FROM catalog_settings WHERE id=1').get())
        await importCatalog(db, seed, { source: 'Catálogo inicial de ejemplo', replace: true, seed: true });
}
export function validateCatalog(input) {
    if (typeof input?.demo !== 'boolean' || input.currency !== 'UYU' || !Array.isArray(input.products) || !input.products.length)
        throw new Error('Se requieren demo, currency UYU y productos.');
    const ids = new Set();
    return input.products.map(p => {
        if (!p || typeof p.id !== 'string' || !/^[\w-]{1,80}$/.test(p.id) || ids.has(p.id))
            throw new Error('SKU inválido o duplicado.');
        ids.add(p.id);
        for (const field of ['name', 'category', 'description'])
            if (typeof p[field] !== 'string' || !p[field].trim() || p[field].length > (field === 'description' ? 4000 : 180))
                throw new Error(`Producto ${p.id}: ${field} inválido.`);
        if (!Number.isSafeInteger(p.price) || p.price <= 0 || p.price > 10000000 || !Number.isSafeInteger(p.stock) || p.stock < 0)
            throw new Error(`Producto ${p.id}: precio entero UYU positivo y stock entero requeridos.`);
        if (p.image && (typeof p.image !== 'string' || !/^(\/[^/]|https:\/\/)/.test(p.image)))
            throw new Error(`Producto ${p.id}: imagen inválida.`);
        if (p.published !== undefined && typeof p.published !== 'boolean')
            throw new Error('published debe ser booleano.');
        if (p.sourcePage !== undefined && (!Number.isSafeInteger(p.sourcePage) || p.sourcePage < 1))
            throw new Error('Página de origen inválida.');
        return { id: p.id, name: p.name.trim(), category: p.category.trim(), description: p.description.trim(), price: p.price, stock: p.stock, image: p.image || '', art: ['bear', 'vase', 'pencils', 'party'].includes(p.art) ? p.art : 'vase', color: /^#[\da-f]{6}$/i.test(p.color || '') ? p.color : '#eae5da', published: p.published ?? input.demo, sourcePage: p.sourcePage ?? null };
    });
}
export async function importCatalog(db, input, { source = '', replace = false, resetStock = false, seed = false } = {}) {
    const products = validateCatalog(input);
    await transaction(db, async () => {
        if (replace)
            await db.exec('UPDATE products SET published=0');
        for (const p of products) {
            await db.prepare('INSERT INTO products(id,data,published,search) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,published=excluded.published,search=excluded.search').run(p.id, JSON.stringify({ ...p, source }), Number(p.published), normalize(`${p.name} ${p.category} ${p.id}`));
            if (resetStock)
                await db.prepare('INSERT INTO inventory VALUES (?,?) ON CONFLICT(id) DO UPDATE SET available=excluded.available').run(p.id, p.stock);
            else
                await db.prepare('INSERT INTO inventory VALUES (?,?) ON CONFLICT DO NOTHING').run(p.id, p.stock);
        }
        const previous = await db.prepare('SELECT demo FROM catalog_settings WHERE id=1').get();
        if (previous && Boolean(previous.demo) !== input.demo && !replace)
            throw new Error('Cambiar modo requiere --replace.');
        if (!seed && previous && Boolean(previous.demo) !== input.demo && !resetStock)
            throw new Error('Cambiar modo requiere --reset-stock tras revisar existencias.');
        await db.prepare('INSERT INTO catalog_settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET demo=excluded.demo').run(Number(input.demo));
        await db.prepare('INSERT INTO catalog_imports(source,count,created) VALUES (?,?,?)').run(source, products.length, new Date().toISOString());
    });
    return products.length;
}
export async function readCatalog(db) {
    return { demo: Boolean((await db.prepare('SELECT demo FROM catalog_settings WHERE id=1').get()).demo), currency: 'UYU', products: (await db.prepare(`SELECT p.data,i.available FROM products p JOIN inventory i ON i.id=p.id WHERE p.published=1 ORDER BY ${productOrder(db)}`).all()).map(row => {
            const { id, name, category, description, price, image, art, color } = JSON.parse(row.data);
            return { id, name, category, description, price, image, art, color, stock: row.available };
        }) };
}
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const publicRows = rows => rows.map(row => { const { id, name, category, description, price, image, art, color } = JSON.parse(row.data); return { id, name, category, description, price, image, art, color, stock: row.available }; });
export async function catalogMode(db) { return Boolean((await db.prepare('SELECT demo FROM catalog_settings WHERE id=1').get()).demo); }
export async function selectedCatalog(db, ids) {
    const safe = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && /^[\w-]{1,80}$/.test(id)).slice(0, 100) : [])];
    return { demo: await catalogMode(db), products: safe.length ? publicRows(await db.prepare(`SELECT p.data,i.available FROM products p JOIN inventory i ON i.id=p.id WHERE p.published=1 AND p.id IN (${safe.map(() => '?').join(',')})`).all(...safe)) : [] };
}
export async function catalogPage(db, params) {
    const page = Math.max(1, Math.min(100000, Number.parseInt(params.get('page')) || 1)), limit = 24;
    const query = normalize((params.get('q') || '').slice(0, 120)).replace(/[\\%_]/g, '\\$&');
    const category = (params.get('categoria') || '').slice(0, 180);
    const clauses = ['p.published=1'], args = [];
    if (query) {
        clauses.push("p.search LIKE ? ESCAPE '\\'");
        args.push(`%${query}%`);
    }
    if (category) {
        clauses.push(`${jsonField(db, 'p.data', 'category')}=?`);
        args.push(category);
    }
    const where = clauses.join(' AND ');
    const total = (await db.prepare(`SELECT count(*) AS n FROM products p WHERE ${where}`).get(...args)).n;
    const order = params.get('orden') === 'menor' ? `${jsonField(db, 'p.data', 'price')} ASC,${productOrder(db)}` : params.get('orden') === 'mayor' ? `${jsonField(db, 'p.data', 'price')} DESC,${productOrder(db)}` : productOrder(db);
    const actual = Math.min(page, Math.max(1, Math.ceil(total / limit)));
    const rows = await db.prepare(`SELECT p.data,i.available FROM products p JOIN inventory i ON i.id=p.id WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args, limit, (actual - 1) * limit);
    const categories = await db.prepare(`SELECT ${jsonField(db, 'data', 'category')} AS name,count(*) AS count FROM products WHERE published=1 GROUP BY name`).all();
    return { demo: await catalogMode(db), currency: 'UYU', products: publicRows(rows), categories, total, page: actual, pages: Math.max(1, Math.ceil(total / limit)) };
}
