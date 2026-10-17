import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDatabase, createApp } from '../server/index.mjs';
const [command, id] = process.argv.slice(2);
if (!['backup', 'check-backup', 'orders', 'show', 'reconcile', 'close-reservation', 'cancel-request'].includes(command))
    throw new Error('Comandos: backup, check-backup archivo, orders, show ID, reconcile ID, close-reservation ID, cancel-request ID');
if (command === 'check-backup') {
    const path = resolve(id || '');
    if (!id || !existsSync(path))
        throw new Error('Indicá un backup existente.');
    const db = new DatabaseSync(path, { readOnly: true });
    if ((await db.prepare('PRAGMA integrity_check').get()).integrity_check !== 'ok')
        throw new Error('Backup dañado.');
    const directory = resolve('server/backups');
    mkdirSync(directory, { recursive: true });
    const restoredPath = resolve(directory, `restore-check-${Date.now()}.sqlite`);
    await backup(db, restoredPath);
    const restored = new DatabaseSync(restoredPath);
    if ((await restored.prepare('PRAGMA integrity_check').get()).integrity_check !== 'ok')
        throw new Error('Falló la restauración de prueba.');
    await db.exec('PRAGMA query_only=ON');
    // Read every table from the snapshot to detect unreadable content, without replacing live data.
    const counts = {};
    for (const row of await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())
        counts[row.name] = (await db.prepare(`SELECT count(*) AS n FROM "${row.name.replaceAll('"', '""')}"`).get()).n;
    console.log(JSON.stringify({ integrity: 'ok', restoredCopy: restoredPath, tables: counts }, null, 2));
    await restored.close();
    await db.close();
}
else {
    const db = await openDatabase();
    try {
        if (command === 'backup') {
            const directory = resolve('server/backups');
            mkdirSync(directory, { recursive: true });
            const path = resolve(directory, `oscal-${new Date().toISOString().replaceAll(':', '-')}.${db.dialect === 'postgres' ? 'dump' : 'sqlite'}`);
            if (db.dialect === 'postgres') {
                if (!process.env.DATABASE_URL_UNPOOLED)
                    throw new Error('Falta DATABASE_URL_UNPOOLED para el backup PostgreSQL.');
                const url = new URL(process.env.DATABASE_URL_UNPOOLED);
                try {
                    execFileSync('pg_dump', ['--format=custom', '--file', path], { env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGSSLMODE: 'verify-full' }, stdio: 'pipe' });
                }
                catch {
                    throw new Error('No se pudo crear el backup. Instalá pg_dump compatible con PostgreSQL 18 y revisá la conexión directa.');
                }
            }
            else
                await backup(db.raw || db, path);
            console.log(path);
        }
        else if (command === 'orders')
            console.log(JSON.stringify(await db.prepare('SELECT id,status,total,created FROM orders ORDER BY created DESC LIMIT 100').all(), null, 2));
        else {
            if (!/^[a-f0-9-]{36}$/.test(id || ''))
                throw new Error('ID inválido.');
            const order = await db.prepare('SELECT * FROM orders WHERE id=?').get(id);
            if (!order)
                throw new Error('Pedido no encontrado.');
            if (command === 'show')
                console.log(JSON.stringify({ id: order.id, status: order.status, total: order.total, created: order.created, ...JSON.parse(order.data) }, null, 2));
            if (command === 'cancel-request') {
                if (!['received', 'awaiting_shipping', 'demo'].includes(order.status) || order.preference)
                    throw new Error('No es una solicitud sin pago. Conciliá antes de cancelar.');
                await db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(id);
                console.log('Solicitud cancelada; no tenía reserva ni cobro.');
            }
            if (['reconcile', 'close-reservation'].includes(command)) {
                if (!process.env.MERCADOPAGO_ACCESS_TOKEN)
                    throw new Error('Falta la configuración de Mercado Pago.');
                const { server, payments } = await createApp({ db });
                try {
                    if (command === 'close-reservation')
                        await payments.closeReservation(id);
                    else if (order.payment)
                        await payments.reconcile(order.payment, id);
                    else
                        throw new Error('No hay ID de pago confirmado. Revisar la operación en Mercado Pago antes de liberar reservas.');
                    console.log('Operación conciliada.');
                }
                finally {
                    server.close();
                }
            }
        }
    }
    finally {
        await db.close();
    }
}
