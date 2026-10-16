// SQLite is the source of truth. The JSON file is only a first-run demo seed.
export function initializeCatalog(db, seed) {
  db.exec(`CREATE TABLE IF NOT EXISTS catalog_settings (id INTEGER PRIMARY KEY CHECK(id=1), demo INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, data TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, available INTEGER NOT NULL CHECK(available>=0));
    CREATE TABLE IF NOT EXISTS catalog_imports (id INTEGER PRIMARY KEY, source TEXT NOT NULL, count INTEGER NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_requests (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, order_id TEXT NOT NULL);`)
  if (!db.prepare('PRAGMA table_info(products)').all().some(c => c.name === 'search')) {
    db.exec("ALTER TABLE products ADD COLUMN search TEXT NOT NULL DEFAULT ''")
    for (const row of db.prepare('SELECT id,data FROM products').all()) { const p = JSON.parse(row.data); db.prepare('UPDATE products SET search=? WHERE id=?').run(normalize(`${p.name} ${p.category} ${p.id}`), row.id) }
  }
  db.exec("CREATE INDEX IF NOT EXISTS products_category ON products(published,json_extract(data,'$.category')); CREATE INDEX IF NOT EXISTS products_price ON products(published,json_extract(data,'$.price'))")
  db.exec('CREATE TABLE IF NOT EXISTS catalog_revision(id INTEGER PRIMARY KEY,version INTEGER NOT NULL); INSERT OR IGNORE INTO catalog_revision VALUES(1,0)')
  for (const table of ['products','inventory','catalog_settings']) for (const event of ['INSERT','UPDATE','DELETE']) db.exec(`CREATE TRIGGER IF NOT EXISTS revision_${table}_${event} AFTER ${event} ON ${table} BEGIN UPDATE catalog_revision SET version=version+1 WHERE id=1; END`)
  if (!db.prepare('SELECT 1 FROM catalog_settings WHERE id=1').get()) importCatalog(db, seed, { source: 'Catálogo inicial de ejemplo', replace: true, seed: true })
}

export function validateCatalog(input) {
  if (typeof input?.demo !== 'boolean' || input.currency !== 'UYU' || !Array.isArray(input.products) || !input.products.length) throw new Error('Se requieren demo, currency UYU y productos.')
  const ids = new Set()
  return input.products.map(p => {
    if (!p || typeof p.id !== 'string' || !/^[\w-]{1,80}$/.test(p.id) || ids.has(p.id)) throw new Error('SKU inválido o duplicado.')
    ids.add(p.id)
    for (const field of ['name', 'category', 'description']) if (typeof p[field] !== 'string' || !p[field].trim() || p[field].length > (field === 'description' ? 4000 : 180)) throw new Error(`Producto ${p.id}: ${field} inválido.`)
    if (!Number.isSafeInteger(p.price) || p.price <= 0 || p.price > 10000000 || !Number.isSafeInteger(p.stock) || p.stock < 0) throw new Error(`Producto ${p.id}: precio entero UYU positivo y stock entero requeridos.`)
    if (p.image && (typeof p.image !== 'string' || !/^(\/[^/]|https:\/\/)/.test(p.image))) throw new Error(`Producto ${p.id}: imagen inválida.`)
    if (p.published !== undefined && typeof p.published !== 'boolean') throw new Error('published debe ser booleano.')
    if (p.sourcePage !== undefined && (!Number.isSafeInteger(p.sourcePage) || p.sourcePage < 1)) throw new Error('Página de origen inválida.')
    return { id: p.id, name: p.name.trim(), category: p.category.trim(), description: p.description.trim(), price: p.price, stock: p.stock, image: p.image || '', art: ['bear', 'vase', 'pencils', 'party'].includes(p.art) ? p.art : 'vase', color: /^#[\da-f]{6}$/i.test(p.color || '') ? p.color : '#eae5da', published: p.published ?? input.demo, sourcePage: p.sourcePage ?? null }
  })
}

export function importCatalog(db, input, { source = '', replace = false, resetStock = false, seed = false } = {}) {
  const products = validateCatalog(input)
  db.exec('BEGIN IMMEDIATE')
  try {
    if (replace) db.exec('UPDATE products SET published=0')
    for (const p of products) {
      db.prepare('INSERT INTO products(id,data,published,search) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,published=excluded.published,search=excluded.search').run(p.id, JSON.stringify({ ...p, source }), Number(p.published), normalize(`${p.name} ${p.category} ${p.id}`))
      if (resetStock) db.prepare('INSERT INTO inventory VALUES (?,?) ON CONFLICT(id) DO UPDATE SET available=excluded.available').run(p.id, p.stock)
      else db.prepare('INSERT OR IGNORE INTO inventory VALUES (?,?)').run(p.id, p.stock)
    }
    // Mode can only change with an explicit complete replacement, preventing mixed demo/live sales.
    const previous = db.prepare('SELECT demo FROM catalog_settings WHERE id=1').get()
    if (previous && Boolean(previous.demo) !== input.demo && !replace) throw new Error('Cambiar modo requiere --replace.')
    if (!seed && previous && Boolean(previous.demo) !== input.demo && !resetStock) throw new Error('Cambiar modo requiere --reset-stock tras revisar existencias.')
    db.prepare('INSERT INTO catalog_settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET demo=excluded.demo').run(Number(input.demo))
    db.prepare('INSERT INTO catalog_imports(source,count,created) VALUES (?,?,?)').run(source, products.length, new Date().toISOString())
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  return products.length
}

export function readCatalog(db) {
  return { demo: Boolean(db.prepare('SELECT demo FROM catalog_settings WHERE id=1').get().demo), currency: 'UYU', products: db.prepare('SELECT p.data,i.available FROM products p JOIN inventory i ON i.id=p.id WHERE p.published=1 ORDER BY p.rowid').all().map(row => {
    const { id, name, category, description, price, image, art, color } = JSON.parse(row.data)
    return { id, name, category, description, price, image, art, color, stock: row.available }
  }) }
}

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const publicRows = rows => rows.map(row => { const { id, name, category, description, price, image, art, color } = JSON.parse(row.data); return { id, name, category, description, price, image, art, color, stock: row.available } })
export function catalogMode(db) { return Boolean(db.prepare('SELECT demo FROM catalog_settings WHERE id=1').get().demo) }
export function selectedCatalog(db, ids) {
  const safe = [...new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && /^[\w-]{1,80}$/.test(id)).slice(0,100) : [])]
  return { demo: catalogMode(db), products: safe.length ? publicRows(db.prepare(`SELECT p.data,i.available FROM products p JOIN inventory i ON i.id=p.id WHERE p.published=1 AND p.id IN (${safe.map(() => '?').join(',')})`).all(...safe)) : [] }
}
export function catalogPage(db, params) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get('page')) || 1)), limit = 24
  const query = normalize((params.get('q') || '').slice(0,120)).replace(/[\\%_]/g, '\\$&')
  const category = (params.get('categoria') || '').slice(0,180)
  const clauses=['p.published=1'], args=[]
  if(query) {clauses.push("p.search LIKE ? ESCAPE '\\'");args.push(`%${query}%`)}
  if(category) {clauses.push("json_extract(p.data,'$.category')=?");args.push(category)}
  const where=clauses.join(' AND ')
  const total = db.prepare(`SELECT count(*) AS n FROM products p WHERE ${where}`).get(...args).n
  const order = params.get('orden') === 'menor' ? "json_extract(p.data,'$.price') ASC,p.rowid" : params.get('orden') === 'mayor' ? "json_extract(p.data,'$.price') DESC,p.rowid" : 'p.rowid'
  const actual = Math.min(page, Math.max(1, Math.ceil(total/limit)))
  const rows = db.prepare(`SELECT p.data,i.available FROM products p JOIN inventory i ON i.id=p.id WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...args,limit,(actual-1)*limit)
  const categories = db.prepare("SELECT json_extract(data,'$.category') AS name,count(*) AS count FROM products WHERE published=1 GROUP BY name").all()
  return { demo: catalogMode(db), currency: 'UYU', products: publicRows(rows), categories, total, page: actual, pages: Math.max(1,Math.ceil(total/limit)) }
}
