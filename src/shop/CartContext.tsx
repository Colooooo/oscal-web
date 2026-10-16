/* eslint-disable react-refresh/only-export-components -- Context and hook form a single public API. */
// Adapted from Ferreteria-pro/src/context/CartContext.jsx.
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { sanitizeCart } from './store'
import type { Line } from './store'
import { useCatalog } from './CatalogContext'
const key = 'oscal-cart-v1'
function read(): Line[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter(p => p && typeof p.id === 'string' && Number.isSafeInteger(p.quantity) && p.quantity > 0) : [] } catch { return [] } }
function useCartState() {
  const { products, loading, error, cartReady } = useCatalog()
  const [stored, setLines] = useState(read)
  const lines = sanitizeCart(stored, products)
  const [notice, setNotice] = useState('')
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(!cartReady ? stored : sanitizeCart(stored, products))) } catch { /* Remains usable without storage. */ } }, [stored, products, loading, error, cartReady])
  const byId = new Map(products.map(p => [p.id,p]))
  const cart = lines.flatMap(line => { const product = byId.get(line.id); return product ? [{ ...product, quantity: line.quantity }] : [] })
  return { lines, cart, notice, count: (!cartReady ? stored : cart).reduce((n,p) => n+p.quantity,0), total: cart.reduce((n, p) => n + p.price * p.quantity, 0),
    add(id: string, quantity = 1) {
      const product = byId.get(id)
      if (!product?.stock) return
      setLines(prev => sanitizeCart(prev.some(p => p.id === id) ? prev.map(p => p.id === id ? { ...p, quantity: p.quantity + quantity } : p) : [...prev, { id, quantity }], products))
      setNotice(`${product.name} agregado al carrito. Cantidades limitadas al stock disponible.`)
    },
    update(id: string, quantity: number) { setLines(prev => sanitizeCart(prev.map(p => p.id === id ? { ...p, quantity } : p), products)) },
    remove(id: string) { setLines(prev => prev.filter(p => p.id !== id)) },
  }
}
const Context = createContext<ReturnType<typeof useCartState> | null>(null)
export function CartProvider({ children }: { children: ReactNode }) { return <Context.Provider value={useCartState()}>{children}</Context.Provider> }
export function useCart() { const value = useContext(Context); if (!value) throw new Error('CartProvider missing'); return value }
