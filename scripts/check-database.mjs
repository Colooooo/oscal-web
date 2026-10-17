import { openDatabase } from '../server/index.mjs';
import { catalogPage } from '../server/catalog.mjs';
const db = await openDatabase();
try {
    const catalog = await catalogPage(db, new URLSearchParams());
    console.log(JSON.stringify({ connected: true, engine: db.dialect, demo: catalog.demo, products: catalog.total }));
}
finally {
    await db.close();
}
