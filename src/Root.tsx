import { StrictMode, lazy, Suspense } from 'react'
const App=lazy(()=>import('./App.tsx'))
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
const Catalog=lazy(()=>import('./shop/Catalog'))
import { CatalogProvider } from './shop/CatalogContext'
import { CartProvider } from './shop/CartContext'
const ShopLayout=lazy(()=>import('./shop/Shop').then(m=>({default:m.ShopLayout})))
const Cart=lazy(()=>import('./shop/Shop').then(m=>({default:m.Cart})))
const Checkout=lazy(()=>import('./shop/Shop').then(m=>({default:m.Checkout})))
const PaymentResult=lazy(()=>import('./shop/Shop').then(m=>({default:m.PaymentResult})))
import { AuthProvider } from './shop/AuthContext'
const Login=lazy(()=>import('./shop/Account').then(m=>({default:m.Login})))
const Account=lazy(()=>import('./shop/Account').then(m=>({default:m.Account})))
const AccountAccess=lazy(()=>import('./shop/AccountAccess'))

export default function Root() { return (
  <StrictMode>
    <BrowserRouter><AuthProvider><CatalogProvider><CartProvider><Suspense fallback={<p role="status" className="p-10 text-center">Cargando…</p>}><Routes>
      <Route path="/" element={<App/>}/>
      <Route element={<ShopLayout/>}>
        <Route path="/catalogo" element={<Catalog/>}/>
        <Route path="/carrito" element={<Cart/>}/>
        <Route path="/checkout" element={<Checkout/>}/>
        <Route path="/pedido" element={<PaymentResult/>}/>
        <Route path="/ingresar" element={<Login/>}/>
        <Route path="/acceso" element={<AccountAccess/>}/>
        <Route path="/cuenta" element={<Account/>}/>
        <Route path="*" element={<div className="py-20 text-center"><h1 className="text-3xl">No encontramos esa página.</h1><Link to="/catalogo" className="mt-6 inline-block underline">Volver al catálogo</Link></div>}/>
      </Route>
    </Routes></Suspense></CartProvider></CatalogProvider></AuthProvider></BrowserRouter>
  </StrictMode>
) }

