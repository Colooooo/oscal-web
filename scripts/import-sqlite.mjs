import { DatabaseSync, backup } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { PostgresDatabase, transaction } from '../server/database.mjs'

// Copy a consistent snapshot, including password hashes and private receipt tokens,
// without ever logging record contents or changing the original SQLite database.
const source = resolve(process.env.OSCAL_DATA_DIR || 'server/data', 'orders.sqlite')
const tables = ['users','orders','inventory','products','catalog_settings','catalog_imports','order_users','order_requests','sessions','account_tokens','checkout_attempts','rate_limits','catalog_revision']
const local = new DatabaseSync(source,{readOnly:true})
const directory = resolve('server/backups')
mkdirSync(directory,{recursive:true})
const path = resolve(directory,`before-neon-${Date.now()}.sqlite`)
try { await backup(local,path) } finally { local.close() }
const snapshot = new DatabaseSync(path,{readOnly:true})
const records = []
try {
  for (const table of tables) {
    const info = snapshot.prepare(`PRAGMA table_info(${table})`).all()
    if (!info.length) continue
    const columns = info.map(c=>c.name)
    const primary = info.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name)
    const rows = snapshot.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY ${primary.join(',')}`).all()
    records.push({table,columns,primary,rows})
  }
} finally { snapshot.close() }
const checksum = createHash('sha256').update(JSON.stringify(records)).digest('hex')
console.log(JSON.stringify({backup:path,tables:Object.fromEntries(records.map(r=>[r.table,r.rows.length]))}))
if (!process.argv.includes('--apply')) {
  console.log('Solo lectura. Agregá --apply para copiar a una base Neon nueva con el esquema preparado.')
} else {
  if (!process.env.DATABASE_URL_UNPOOLED) throw new Error('Falta DATABASE_URL_UNPOOLED.')
  const db = new PostgresDatabase(process.env.DATABASE_URL_UNPOOLED)
  try {
    await transaction(db,async()=>{
      await db.exec('CREATE TABLE IF NOT EXISTS oscal_sqlite_imports(checksum TEXT PRIMARY KEY,imported_at TEXT NOT NULL)')
      if (await db.prepare('SELECT 1 FROM oscal_sqlite_imports WHERE checksum=?').get(checksum)) {
        console.log('Este snapshot ya fue importado. No se modificaron registros.')
        return
      }
      const seedOnly = new Set(['products','inventory','catalog_settings','catalog_imports','catalog_revision'])
      for (const record of records) {
        const current = await db.prepare(`SELECT count(*) AS n FROM ${record.table}`).get()
        if (current.n && !seedOnly.has(record.table)) throw new Error(`Destino con datos en ${record.table}: se cancela la copia para no sobrescribirlos.`)
      }
      const imports = await db.prepare('SELECT source FROM catalog_imports').all()
      if (imports.length > 1 || imports.some(row=>row.source !== 'Catálogo inicial de ejemplo')) throw new Error('El catálogo de destino ya fue modificado. Se cancela la copia.')
      for (const {table,columns,primary,rows} of records) {
        const updates = columns.filter(c=>!primary.includes(c)).map(c=>`${c}=excluded.${c}`).join(',')
        const statement = db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(${primary.join(',')}) DO UPDATE SET ${updates}`)
        for (const row of rows) await statement.run(...columns.map(column=>row[column]))
        const copied = await db.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY ${primary.join(',')}`).all()
        if (JSON.stringify(copied) !== JSON.stringify(rows)) throw new Error(`La verificación de ${table} no coincide. Se revierte toda la copia.`)
      }
      await db.prepare("SELECT setval(pg_get_serial_sequence('catalog_imports','id'),GREATEST(COALESCE(MAX(id),0),1),MAX(id) IS NOT NULL) FROM catalog_imports").get()
      await db.prepare('INSERT INTO oscal_sqlite_imports VALUES(?,?)').run(checksum,new Date().toISOString())
      console.log('Copia confirmada: todos los registros coinciden con el snapshot local.')
    })
  } finally { await db.close() }
}
