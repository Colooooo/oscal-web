import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { initializeCatalog, importCatalog, validateCatalog } from '../server/catalog.mjs'
const args = process.argv.slice(2)
const file = args.find(arg => !arg.startsWith('--'))
if (!file || args.some(arg => arg.startsWith('--') && !['--apply', '--replace', '--reset-stock'].includes(arg))) throw new Error('Uso: npm run catalog:import -- archivo.json [--apply] [--replace] [--reset-stock]')
const input = JSON.parse(readFileSync(file, 'utf8'))
const products = validateCatalog(input)
console.log(`${products.length} productos válidos; ${products.filter(p => p.published).length} publicados; modo ${input.demo ? 'ejemplo' : 'real'}.`)
if (args.includes('--apply')) {
  mkdirSync(new URL('../server/data', import.meta.url), { recursive: true })
  const db = new DatabaseSync(fileURLToPath(new URL('../server/data/orders.sqlite', import.meta.url)))
  db.exec('PRAGMA journal_mode=WAL')
  initializeCatalog(db, JSON.parse(readFileSync(new URL('../shared/catalog.json', import.meta.url), 'utf8')))
  importCatalog(db, input, { source: input.source || file, replace: args.includes('--replace'), resetStock: args.includes('--reset-stock') })
  db.close()
  console.log('Importación confirmada. Los pedidos anteriores se conservan.')
} else console.log('Solo validación: no se modificó la base. Agregá --apply para importar.')
