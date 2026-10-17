import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
const scopes = new AsyncLocalStorage();
const queues = new WeakMap();
async function exclusive(db, work) {
    const previous = queues.get(db) || Promise.resolve();
    let release;
    const next = new Promise(resolve => { release = resolve; });
    queues.set(db, next);
    await previous;
    try {
        return await work();
    }
    finally {
        release();
        if (queues.get(db) === next)
            queues.delete(db);
    }
}
// Parameters stay separate from SQL; '?' placeholders are shared with SQLite.
function placeholders(sql) {
    let index = 0;
    return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, token => token === '?' ? `$${++index}` : token);
}
export class PostgresDatabase {
    dialect = 'postgres';
    constructor(connectionString) {
        this.pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000,
            types: { getTypeParser: (oid, format) => oid === 20 ? Number : pg.types.getTypeParser(oid, format) } });
        this.pool.on('error', () => console.error('La conexión de base de datos se interrumpió.'));
    }
    async query(sql, values = []) {
        const scope = scopes.getStore();
        const client = scope?.db === this ? scope.client : this.pool;
        return client.query(placeholders(sql), values);
    }
    async exec(sql) { await this.query(sql); }
    prepare(sql) {
        return {
            get: async (...values) => (await this.query(sql, values)).rows[0],
            all: async (...values) => (await this.query(sql, values)).rows,
            run: async (...values) => ({ changes: (await this.query(sql, values)).rowCount }),
        };
    }
    async close() { await this.pool.end(); }
}
export class SqliteDatabase {
    dialect = 'sqlite';
    constructor(path) { this.raw = new DatabaseSync(path); }
    async access(work) {
        return scopes.getStore()?.db === this ? work() : exclusive(this, work);
    }
    async exec(sql) { return this.access(() => this.raw.exec(sql)); }
    prepare(sql) {
        return Object.fromEntries(['get', 'all', 'run'].map(method => [method,
            (...values) => this.access(() => this.raw.prepare(sql)[method](...values))]));
    }
    async close() { return this.access(() => this.raw.close()); }
}
export async function transaction(db, work) {
    if (scopes.getStore()?.db === db)
        return work();
    if (db.dialect === 'postgres') {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            // Preserve SQLite's serialized write transactions across API processes.
            await client.query('SELECT pg_advisory_xact_lock(731946182)');
            const value = await scopes.run({ db, client }, work);
            await client.query('COMMIT');
            return value;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    return exclusive(db, async () => {
        const raw = db.raw || db;
        raw.exec('BEGIN IMMEDIATE');
        try {
            const value = await scopes.run({ db }, work);
            raw.exec('COMMIT');
            return value;
        }
        catch (error) {
            raw.exec('ROLLBACK');
            throw error;
        }
    });
}
export const jsonField = (db, column, field) => db.dialect === 'postgres'
    ? field === 'price' ? `((${column}::jsonb->>'${field}')::bigint)` : `(${column}::jsonb->>'${field}')`
    : `json_extract(${column},'$.${field}')`;
export const productOrder = db => db.dialect === 'postgres' ? 'p.position' : 'p.rowid';
