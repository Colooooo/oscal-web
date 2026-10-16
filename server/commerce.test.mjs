import test from 'node:test'
import assert from 'node:assert/strict'
import { validateOrder, verifiedPayment, canCharge } from './commerce.mjs'
const catalog = { demo: true, products: [{ id: 'a', name: 'Uno', price: 490, stock: 3 }] }
const input = { items: [{ id: 'a', quantity: 2, price: 1 }], customer: { name: 'Cliente', email: 'test@example.com', phone: '099000000', delivery: 'pickup' } }
test('Uses server prices, never client prices', () => assert.equal(validateOrder(input, catalog).total, 980))
test('Rejects unknown, duplicate, fractional, negative and overstock lines', () => {
  for (const items of [[], [{ id: 'b', quantity: 1 }], [{ id: 'a', quantity: -1 }], [{ id: 'a', quantity: 1.5 }], [{ id: 'a', quantity: 4 }], [{ id: 'a', quantity: 1 }, { id: 'a', quantity: 1 }]]) assert.throws(() => validateOrder({ ...input, items }, catalog))
})
test('Unquoted delivery cannot be charged', () => assert.throws(() => validateOrder({ ...input, customer: { ...input.customer, delivery: 'delivery' } }, catalog)))
test('Demo catalog cannot charge even with enabled credentials', () => assert.equal(canCharge(catalog, { PAYMENTS_ENABLED: 'true', MERCADOPAGO_ACCESS_TOKEN: 'test', PUBLIC_URL: 'https://example.com' }), false))
test('Verification requires matching reference, amount and currency', () => {
  const order = { id: 'o', total: 980 }
  const payment = { external_reference: 'o', transaction_amount: 980, currency_id: 'UYU' }
  assert.equal(verifiedPayment(payment, order), true)
  for (const patch of [{ external_reference: 'x' }, { transaction_amount: 1 }, { currency_id: 'USD' }]) assert.equal(verifiedPayment({ ...payment, ...patch }, order), false)
})
