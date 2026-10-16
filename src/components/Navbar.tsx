import { useEffect, useRef, useState } from 'react'
import './Navbar.css'
import { Link } from 'react-router-dom'
import { useCart } from '../shop/CartContext'

const links = [
  { id: 'catalogo', text: 'Catálogo' },
  { id: 'nosotros', text: 'Somos Oscal' },
  { id: 'contacto', text: 'Encontranos' },
  { id: 'cuenta', text: 'Mi cuenta' },
]

function NavArrow() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

export default function Navbar() {
  const { count } = useCart()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    }, { rootMargin: '-15% 0px -60% 0px' })
    for (const link of links) {
      const section = document.getElementById(link.id)
      if (section) observer.observe(section)
    }
    const desktop = window.matchMedia('(min-width: 801px)')
    const onDesktop = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', onDesktop)
    return () => {
      window.removeEventListener('scroll', onScroll)
      desktop.removeEventListener('change', onDesktop)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open])

  return <>
    <button className={`nav-dismiss${open ? ' is-open' : ''}`} onClick={() => setOpen(false)} tabIndex={-1} aria-label="Cerrar menú" aria-hidden={!open}/>
    <header className={`navbar${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <a className="navbar-brand" href="/#inicio" aria-label="Oscal Importaciones, inicio" onClick={() => { setOpen(false); setActive('') }}>
        <img src="/oscal-logo.svg" alt="Oscal SRL Importaciones" width="581" height="261"/>
      </a>
      <nav className="navbar-links" aria-label="Navegación principal">
        {links.map(link => <a key={link.id} className={active === link.id && scrolled ? 'is-active' : ''} aria-current={active === link.id && scrolled ? 'location' : undefined} href={['catalogo', 'cuenta'].includes(link.id) ? ('/' + link.id) : `/#${link.id}`}><span>{link.text}</span><i aria-hidden="true"/></a>)}
      </nav>
      <Link className="navbar-catalog" to="/carrito" aria-label={`Carrito, ${count} productos`}><span>Carrito · {count}</span><span className="navbar-catalog-icon"><NavArrow/></span></Link>
      <button ref={toggle} className="navbar-toggle" aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? 'Cerrar navegación' : 'Abrir navegación'} onClick={() => setOpen(!open)}><span/><span/></button>
      <nav id="mobile-navigation" className="navbar-mobile" aria-label="Navegación móvil" aria-hidden={!open} inert={!open}>
        <span className="navbar-mobile-label">DESCUBRÍ OSCAL</span>
        {links.map((link, index) => <a key={link.id} href={['catalogo', 'cuenta'].includes(link.id) ? ('/' + link.id) : `/#${link.id}`} onClick={() => setOpen(false)}><span className="navbar-mobile-number">0{index + 1}</span><span>{link.text}</span><NavArrow/></a>)}
        <Link className="navbar-mobile-catalog" to="/carrito" onClick={() => setOpen(false)}><span>Mi carrito ({count})</span><NavArrow/></Link>
        <p>Arenal Grande 2178 · Montevideo</p>
      </nav>
    </header>
  </>
}
