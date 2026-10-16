export const MAX_TOTAL = 10000000
export function validateOrder(input, catalog) {
  if (!Array.isArray(input?.items) || !input.items.length || input.items.length > 100) throw new Error('El carrito está vacío o es inválido.')
  const seen = new Set()
  const items = input.items.map(line => {
    const p = catalog.products.find(p => p.id === line?.id)
    if (!p || seen.has(p.id) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > p.stock) throw new Error('Revisá productos y cantidades del carrito.')
    seen.add(p.id)
    if (!Number.isSafeInteger(p.price) || p.price <= 0) throw new Error('Precio de catálogo inválido.')
    return { id: p.id, title: p.name, quantity: line.quantity, unit_price: p.price, currency_id: 'UYU' }
  })
  const customer = input.customer
  if (!customer || !['pickup', 'delivery'].includes(customer.delivery)) throw new Error('Elegí una forma de entrega.')
  for (const field of ['name', 'email', 'phone']) {
    if (typeof customer[field] !== 'string' || !customer[field].trim() || customer[field].length > 120) throw new Error('Completá tus datos de contacto.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new Error('El correo electrónico es inválido.')
  if (customer.delivery !== 'pickup') throw new Error('El envío necesita una cotización antes de pagar.')
  if (customer.notes && (typeof customer.notes !== 'string' || customer.notes.length > 500)) throw new Error('Comentarios inválidos.')
  const total = items.reduce((sum, p) => sum + p.unit_price * p.quantity, 0)
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_TOTAL) throw new Error('El importe supera el límite del pedido.')
  return { items, customer: { name: customer.name.trim(), email: customer.email.trim(), phone: customer.phone.trim(), delivery: 'pickup', notes: customer.notes || '' }, total }
}
export function verifiedPayment(payment, order) {
  return String(payment.external_reference) === order.id && payment.currency_id === 'UYU' && Number(payment.transaction_amount) === order.total
}
export function canCharge(catalog, env) {
  return !catalog.demo && env.PAYMENTS_ENABLED === 'true' && Boolean(env.MERCADOPAGO_ACCESS_TOKEN) && Boolean(env.MERCADOPAGO_WEBHOOK_SECRET) && /^https:\/\//.test(env.PUBLIC_URL || '')
}
