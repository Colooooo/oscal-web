import { transaction } from './database.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { validateOrder } from './commerce.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
// The random request key is also the guest's private receipt token. Never log it.
export async function submitOrder(db, input, catalog, userId) {
    if (!/^[a-f0-9]{64}$/.test(input?.requestKey || ''))
        throw new Error('Referencia de solicitud inválida.');
    const key = hash(input.requestKey);
    const fingerprint = hash(JSON.stringify({ items: input.items, customer: input.customer, userId: userId || null }));
    return await transaction(db, async () => {
        const previous = await db.prepare('SELECT * FROM order_requests WHERE key=?').get(key);
        if (previous) {
            if (previous.fingerprint !== fingerprint)
                throw new Error('Esta referencia ya fue utilizada con otro pedido.');
            const order = await db.prepare('SELECT status FROM orders WHERE id=?').get(previous.order_id);
            return { id: previous.order_id, status: order.status, token: input.requestKey };
        }
        const delivery = input.customer?.delivery;
        if (!['pickup', 'delivery'].includes(delivery))
            throw new Error('Elegí una forma de entrega.');
        const order = validateOrder({ ...input, customer: { ...input.customer, delivery: 'pickup' } }, catalog);
        if (delivery === 'delivery') {
            for (const field of ['address', 'city'])
                if (typeof input.customer[field] !== 'string' || !input.customer[field].trim() || input.customer[field].length > (field === 'address' ? 180 : 120))
                    throw new Error('Completá dirección y localidad.');
            order.customer = { ...order.customer, delivery, address: input.customer.address.trim(), city: input.customer.city.trim() };
        }
        const id = randomUUID();
        const status = catalog.demo ? 'demo' : delivery === 'delivery' ? 'awaiting_shipping' : 'received';
        await db.prepare('INSERT INTO orders(id,token,data,total,status,created) VALUES(?,?,?,?,?,?)').run(id, key, JSON.stringify(order), order.total, status, new Date().toISOString());
        if (userId)
            await db.prepare('INSERT INTO order_users VALUES (?,?)').run(id, userId);
        await db.prepare('INSERT INTO order_requests VALUES (?,?,?)').run(key, fingerprint, id);
        return { id, status, token: input.requestKey };
    });
}
