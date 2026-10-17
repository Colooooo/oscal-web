import { attachDatabasePool, waitUntil } from '@vercel/functions';
import { openDatabase, createHandler } from '../server/index.mjs';
import { createVercelHandler } from '../server/runtime.mjs';

export default createVercelHandler({
    env: { ...process.env, VERCEL: '1' },
    connect: openDatabase,
    create: createHandler,
    attachPool: attachDatabasePool,
    background: waitUntil,
});
