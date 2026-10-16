export type Product = { id: string; name: string; category: string; description: string; price: number; stock: number; image?: string; art: string; color: string }
export type Line = { id: string; quantity: number }
export type Customer = { name: string; email: string; phone: string; delivery: 'pickup' | 'delivery'; address: string; city: string; notes: string }
export const money = (value: number) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(value)
export function sanitizeCart(value: unknown, products: Product[]): Line[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const byId = new Map(products.map(p => [p.id,p]))
  return value.flatMap(item => {
    const product = byId.get(item?.id)
    if (!product || !product.stock || seen.has(product.id)) return []
    seen.add(product.id)
    return [{ id: product.id, quantity: Math.min(product.stock, Math.max(1, Math.floor(Number(item.quantity) || 1))) }]
  })
}
