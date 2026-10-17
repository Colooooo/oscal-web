import { readFileSync } from 'node:fs';
import { openDatabase } from '../server/index.mjs';
import { importCatalog, validateCatalog } from '../server/catalog.mjs';
const args = process.argv.slice(2);
const file = args.find(arg => !arg.startsWith('--'));
if (!file || args.some(arg => arg.startsWith('--') && !['--apply', '--replace', '--reset-stock'].includes(arg)))
    throw new Error('Uso: npm run catalog:import -- archivo.json [--apply] [--replace] [--reset-stock]');
const input = JSON.parse(readFileSync(file, 'utf8'));
const products = validateCatalog(input);
console.log(`${products.length} productos válidos; ${products.filter(p => p.published).length} publicados; modo ${input.demo ? 'ejemplo' : 'real'}.`);
if (args.includes('--apply')) {
    const db = await openDatabase();
    try {
        await importCatalog(db, input, { source: input.source || file, replace: args.includes('--replace'), resetStock: args.includes('--reset-stock') });
    }
    finally {
        await db.close();
    }
    console.log('Importación confirmada. Los pedidos anteriores se conservan.');
}
else
    console.log('Solo validación: no se modificó la base. Agregá --apply para importar.');
