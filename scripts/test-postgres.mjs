import { spawnSync } from 'node:child_process';
if (process.env.NEON_BRANCH_NAME !== 'development' || !process.env.DATABASE_URL)
    throw new Error('Las pruebas PostgreSQL requieren la rama development en .env.local.');
const result = spawnSync(process.execPath, ['--test', 'server/postgres.test.mjs'], {
    env: { ...process.env, OSCAL_TEST_DATABASE_URL: process.env.DATABASE_URL }, stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
