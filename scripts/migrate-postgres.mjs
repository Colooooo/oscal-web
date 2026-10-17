import { readFileSync, readdirSync } from 'node:fs';
import { PostgresDatabase, transaction } from '../server/database.mjs';
import { initializeCatalog } from '../server/catalog.mjs';
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url || new URL(url).hostname.includes('-pooler.'))
    throw new Error('Configurá DATABASE_URL_UNPOOLED con la conexión directa de Neon.');
const db = new PostgresDatabase(url);
try {
    await transaction(db, async () => {
        await db.exec('CREATE TABLE IF NOT EXISTS oscal_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)');
        const directory = new URL('../server/migrations/', import.meta.url);
        for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
            if (await db.prepare('SELECT 1 FROM oscal_migrations WHERE name=?').get(name))
                continue;
            await db.exec(readFileSync(new URL(name, directory), 'utf8'));
            await db.prepare('INSERT INTO oscal_migrations VALUES(?,?)').run(name, new Date().toISOString());
            console.log(`Migración aplicada: ${name}`);
        }
        await initializeCatalog(db, JSON.parse(readFileSync(new URL('../shared/catalog.json', import.meta.url), 'utf8')));
    });
    console.log('Base PostgreSQL preparada; el catálogo inicial queda en modo de ejemplo.');
}
finally {
    await db.close();
}
