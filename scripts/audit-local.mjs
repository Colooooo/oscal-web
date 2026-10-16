// Read-only HTTP probes and isolated in-memory fixtures. No real accounts or orders are changed.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, writeFileSync } from 'node:fs'
import { initializeCatalog, importCatalog, readCatalog, catalogPage } from '../server/catalog.mjs'
import { createAuth } from '../server/auth.mjs'
const seed = JSON.parse(readFileSync(new URL('../shared/catalog.json', import.meta.url), 'utf8'))
const report = { date: new Date().toISOString(), node: process.version, catalog: [], http: [], security: {} }
for (const count of [8, 1000, 5000]) {
  const db = new DatabaseSync(':memory:')
  initializeCatalog(db, seed)
  if (count !== 8) importCatalog(db, { ...seed, products: Array.from({ length: count }, (_, i) => ({ ...seed.products[0], id: `BENCH-${i}` })) }, { replace: true })
  for (let i = 0; i < 5; i++) readCatalog(db)
  const times = []
  for (let i = 0; i < 30; i++) { const start = performance.now(); readCatalog(db); times.push(performance.now() - start) }
  times.sort((a,b) => a-b)
  report.catalog.push({ products: count, medianMs: +times[15].toFixed(3), p95Ms: +times[28].toFixed(3), jsonBytes: Buffer.byteLength(JSON.stringify(readCatalog(db))) })
  const paged=[]
  for(let i=0;i<30;i++){const start=performance.now();catalogPage(db,new URLSearchParams());paged.push(performance.now()-start)}
  paged.sort((a,b)=>a-b)
  report.catalog.at(-1).pageMedianMs=+paged[15].toFixed(3)
  report.catalog.at(-1).pageJsonBytes=Buffer.byteLength(JSON.stringify(catalogPage(db,new URLSearchParams())))
  db.close()
}

// All five requests enter the body reader before hashing begins, modelling delayed request bodies.
{
  const db = new DatabaseSync(':memory:')
  const auth = createAuth(db, { origin: 'https://audit.example' })
  let release
  const barrier = new Promise(resolve => { release = resolve })
  let readers = 0
  const statuses = []
  const calls = Array.from({ length: 5 }, (_, i) => auth.handle({ method: 'POST', headers: { origin: 'https://audit.example', 'content-type': 'application/json' }, socket: { remoteAddress: `audit-${i}` } }, { setHeader() {} }, '/api/auth/register', async () => {
    readers++; await barrier
    return { name: 'Audit fixture', email: `isolated-${i}@example.com`, password: 'isolated fixture password' }
  }, (_res, code) => { statuses.push(code) }))
  report.security.hashConcurrencyBodyReaders = readers
  release()
  await Promise.all(calls)
  report.security.hashConcurrencyAcceptedRegistrations = statuses.filter(code => code === 200).length
  db.close()
}
{
  const db = new DatabaseSync(':memory:')
  const auth = createAuth(db, { origin: 'https://audit.example', trustedProxies: ['127.0.0.1'] })
  const statuses = []
  for (let i = 0; i < 16; i++) await auth.handle({ method: 'POST', headers: { origin: 'https://audit.example', 'content-type': 'application/json', 'x-real-ip': `192.0.2.${i+1}` }, socket: { remoteAddress: '127.0.0.1' } }, {}, '/api/auth/login', async () => ({}), (_res, code) => { statuses.push(code) })
  report.security.distinctForwardedClients = 16
  report.security.lastForwardedClientStatus = statuses.at(-1)
  db.close()
}
const base = process.env.AUDIT_URL || 'http://127.0.0.1:3001'
const index = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const asset = index.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1]
for (const path of ['/', asset, '/oscal-hero-1280.webp', '/api/catalog', '/api/auth/session', '/api/orders/00000000-0000-0000-0000-000000000000'].filter(Boolean)) {
  try {
    const start = performance.now()
    const response = await fetch(base + path, { headers: { 'Accept-Encoding': 'gzip, br' }, signal: AbortSignal.timeout(5000) })
    const bytes = (await response.arrayBuffer()).byteLength
    const names = ['content-type', 'content-encoding', 'cache-control', 'etag', 'content-security-policy', 'x-frame-options', 'referrer-policy', 'strict-transport-security', 'x-content-type-options']
    report.http.push({ path, status: response.status, bytes, elapsedMs: +(performance.now() - start).toFixed(2), headers: Object.fromEntries(names.map(name => [name, response.headers.get(name)])) })
  } catch (error) { report.http.push({ path, error: error.message }) }
}
writeFileSync(new URL('../output/auditoria-mediciones-optimizadas.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
