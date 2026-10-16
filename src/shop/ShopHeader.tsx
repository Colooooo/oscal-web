import { Link, NavLink } from 'react-router-dom'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'

export default function ShopHeader() {
  const { count } = useCart()
  const { user } = useAuth()
  return <header className="sticky top-0 z-30 border-b border-[#292d4b15] bg-[#f8f6ef]/95 backdrop-blur-xl">
    <div className="hidden bg-[#292d4b] px-6 py-2 text-center text-[10px] tracking-[.16em] text-white/80 sm:block">JUGUETERÍA · BAZAR · ESCOLARES · COTILLÓN</div>
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-10">
      <Link to="/" aria-label="Oscal, volver al inicio"><img src="/oscal-logo.svg" alt="Oscal Importaciones" className="w-24 sm:w-28" width="581" height="261"/></Link>
      <nav aria-label="Navegación de la tienda" className="flex items-center gap-5 text-xs sm:gap-9 sm:text-sm">
        <NavLink to="/catalogo" className={({isActive}) => `py-2 ${isActive ? 'border-b border-[#ed4c55] font-semibold' : ''}`}>Catálogo</NavLink>
        <NavLink to={user ? '/cuenta' : '/ingresar'} aria-label={user ? 'Mi cuenta' : 'Ingresar'} className="flex items-center gap-2"><svg aria-hidden="true" width="20" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 22v-3a8 8 0 0 1 16 0v3" stroke="currentColor" strokeWidth="1.5"/></svg><span className="hidden sm:inline">{user ? 'Mi cuenta' : 'Ingresar'}</span></NavLink>
        <NavLink to="/carrito" aria-label={`Carrito, ${count} productos`} className="flex items-center gap-3 rounded-full bg-[#292d4b] py-2 pl-4 pr-2 text-white transition hover:bg-[#b64349]"><svg width="17" height="19" viewBox="0 0 20 22" fill="none" aria-hidden="true"><path d="M3 7h14l1 13H2L3 7ZM6 8V5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.5"/></svg><span className="hidden sm:inline">Mi bolsa</span><span className="grid size-7 place-items-center rounded-full bg-white/15 text-xs">{count}</span></NavLink>
      </nav>
    </div>
  </header>
}
