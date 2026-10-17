import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import ShopHeader from './ShopHeader'
import Art from '../components/ProductArt'
import { useCart } from './CartContext'
import { money } from './store'
import { useCatalog } from './CatalogContext'
import type { Customer, Product } from './store'
import QuantitySelector from './QuantitySelector'
import { api, useAuth } from './AuthContext'

const primary = 'inline-flex items-center justify-center gap-3 rounded-full bg-[#292d4b] px-6 py-3.5 text-sm font-semibold text-white transition duration-150 hover:bg-[#b64349] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40'
const field = 'mt-2 w-full rounded-xl border border-[#292d4b25] bg-white px-4 py-3 text-sm outline-offset-4 focus:outline-[#b64349]'
const title = 'text-4xl font-medium tracking-[-.05em] sm:text-6xl'

export function ShopLayout() {
  const { initialLoading: loading, error, reload } = useCatalog()
  const { notice } = useCart()
  const { pathname } = useLocation()
  const heading = useRef<HTMLElement>(null)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); heading.current?.focus({ preventScroll: true }) }, [pathname])
  return <><ShopHeader/><main ref={heading} tabIndex={-1} className="shop mx-auto min-h-[85svh] max-w-7xl px-5 pt-6 pb-20 outline-none sm:px-10">
    {['/catalogo', '/carrito', '/checkout'].includes(pathname) && (loading || error) ? <div className="py-20 text-center" role="status">{loading ? 'Cargando catálogo…' : <><p>{error}</p><button className="mt-5 underline" onClick={reload}>Reintentar</button></>}</div> : <Outlet/>}
    <p role="status" className="sr-only">{notice}</p>
  </main><footer className="border-t border-[#292d4b15] px-6 py-8 text-center text-xs text-[#72737e]">Oscal Importaciones · Arenal Grande 2178, Montevideo · <Link to="/">Volver al inicio</Link></footer></>
}

function ProductImage({ product }: { product: Product }) {
  return product.image ? <img src={product.image} alt={product.name} loading="lazy" className="h-full max-h-72 w-full object-contain"/> : <Art kind={product.art}/>
}

// Native product dialog and quantity flow adapted from Ferreteria-pro ProductCard.
export function ProductCard({ product, onSelect }: { product: Product; onSelect:(product:Product)=>void }) {
  const {add,cart}=useCart()
  const selected=cart.find(p=>p.id===product.id)?.quantity || 0, remaining=product.stock-selected
  return <article className="group overflow-hidden rounded-xl bg-transparent"><button className="relative grid h-60 w-full place-items-center overflow-hidden rounded-xl sm:h-64" style={{background:product.color}} onClick={()=>onSelect(product)} aria-label={`Ver detalles de ${product.name}`}><span className="absolute top-4 left-4 text-[9px] font-medium uppercase tracking-[.12em]">{product.category}</span><div className="h-44 w-48 drop-shadow-[0_16px_8px_#292d4b14] transition duration-300 group-hover:-translate-y-1 group-hover:rotate-3"><ProductImage product={product}/></div><span className="absolute right-4 bottom-4 grid size-8 place-items-center rounded-full bg-white/60">↗</span></button><div className="px-1 pt-4 pb-1"><p className="text-[10px] tracking-widest text-[#72737e]">{product.id}</p><h3 className="mt-1 text-base font-medium tracking-tight"><button className="text-left" onClick={()=>onSelect(product)}>{product.name}</button></h3><div className="mt-4 flex items-center justify-between gap-2"><strong className="text-lg font-medium">{money(product.price)} <small className="text-[10px] text-[#72737e]">UYU</small></strong><button disabled={remaining<=0} onClick={()=>add(product.id)} className="rounded-lg bg-[#292d4b] px-4 py-2.5 text-xs text-white transition hover:bg-[#b64349] disabled:bg-[#eeebe3] disabled:text-[#72737e]" aria-label={`Agregar ${product.name} al carrito`}>{!product.stock?'Agotado':remaining<=0?'Máximo agregado':'+ Agregar'}</button></div>{selected>0 && <p className="mt-3 text-xs text-[#61714d]">✓ {selected} en tu carrito</p>}</div></article>
}
export function ProductDialog({product,onClose}:{product:Product;onClose:()=>void}) {
  const {add,cart}=useCart(), dialog=useRef<HTMLDialogElement>(null)
  const [quantity,setQuantity]=useState(1)
  const remaining=product.stock-(cart.find(p=>p.id===product.id)?.quantity || 0)
  useEffect(()=>{dialog.current?.showModal()},[])
  return <dialog ref={dialog} aria-label={product.name} onClose={onClose} onClick={e=>{if(e.target===dialog.current) dialog.current.close()}} className="m-auto max-h-[90dvh] w-[calc(100%-32px)] max-w-3xl overflow-y-auto rounded-3xl bg-[#f8f6ef] p-0 text-[#292d4b] shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"><div className="relative grid sm:grid-cols-2"><button aria-label="Cerrar producto" className="absolute top-4 right-4 z-10 size-10 rounded-full bg-white" onClick={()=>dialog.current?.close()}>✕</button><div className="grid min-h-60 place-items-center p-12" style={{background:product.color}}><ProductImage product={product}/></div><div className="p-7 pt-16 sm:p-9 sm:pt-16"><p className="text-xs text-[#72737e]">{product.category} · {product.id}</p><h3 className="mt-4 text-3xl tracking-tight">{product.name}</h3><p className="mt-4 text-sm leading-7 text-[#72737e]">{product.description}</p><p className="my-6 text-2xl">{money(product.price)} UYU</p>{remaining>0 ? <><QuantitySelector quantity={quantity} max={remaining} label={product.name} onChange={setQuantity}/><button className={`${primary} mt-5 w-full`} onClick={()=>{add(product.id,quantity);dialog.current?.close()}}>Agregar al carrito · {money(quantity*product.price)}</button></> : <p className="text-sm">Sin unidades disponibles para agregar.</p>}</div></div></dialog>
}

function Empty() { return <div className="py-20 text-center"><p className="mb-5 text-5xl">＋</p><h1 className={title}>Tu próxima idea empieza acá.</h1><p className="mt-5 mb-8 text-[#72737e]">Todavía no agregaste productos al carrito.</p><Link to="/catalogo" className={primary}>Explorar catálogo ↗</Link></div> }
function Summary({ delivery, children }: { delivery?: string; children?: ReactNode }) {
  const { demo } = useCatalog()
  const { cart, total, count } = useCart()
  return <aside className="h-fit rounded-2xl border border-[#292d4b15] bg-[#eae5da] p-6 sm:p-8 lg:sticky lg:top-32"><h3 className="text-xl font-medium">Tu resumen <span className="text-sm text-[#72737e]">({count})</span></h3><div className="mt-6 space-y-4">{cart.map(p => <div key={p.id} className="flex justify-between gap-4 text-sm"><span className="text-[#646573]">{p.quantity} × {p.name}</span><span className="shrink-0">{money(p.price * p.quantity)}</span></div>)}</div><div className="mt-6 space-y-3 border-t border-[#292d4b20] pt-5 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(total)}</span></div><div className="flex justify-between gap-3"><span>{delivery === 'delivery' ? 'Envío' : 'Retiro en el local'}</span><span>{delivery === 'delivery' ? 'A coordinar' : 'Sin costo'}</span></div><div className="flex justify-between pt-3 text-xl"><strong className="font-medium">{delivery === 'delivery' ? 'Productos' : 'Total'}</strong><strong className="font-medium">{money(total)}</strong></div><p className="text-xs leading-5 text-[#72737e]">UYU{delivery === 'delivery' ? ' · El envío se cotiza antes de pagar.' : ''}{demo ? ' · Precios de ejemplo.' : ''}</p></div>{children}</aside>
}
export function Cart() {
  const { cart, update, remove } = useCart()
  if (!cart.length) return <Empty/>
  return <><Link to="/catalogo" className="text-sm">← Seguir explorando</Link><h1 className={`${title} mt-6 mb-9`}>Tus elegidos.</h1><div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]"><div className="space-y-4">{cart.map(p => <article key={p.id} className="flex flex-wrap items-center gap-5 rounded-xl border border-[#292d4b15] bg-white p-5"><div className="grid size-24 shrink-0 place-items-center rounded-xl p-3" style={{ background: p.color }}><ProductImage product={p}/></div><div className="min-w-36 flex-1"><p className="text-xs text-[#72737e]">{p.category}</p><h3 className="mt-1 text-lg font-medium">{p.name}</h3><p className="mt-2 text-sm">{money(p.price)} por unidad</p><button className="mt-2 text-xs text-[#b64349] underline" onClick={() => remove(p.id)} aria-label={`Quitar ${p.name}`}>Quitar</button></div><div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col"><QuantitySelector quantity={p.quantity} max={p.stock} label={p.name} onChange={q => update(p.id, q)}/><strong className="font-medium">{money(p.price * p.quantity)}</strong></div></article>)}</div><Summary><Link className={`${primary} mt-7 w-full`} to="/checkout">Continuar con mi pedido →</Link><p className="mt-4 text-center text-xs text-[#72737e]">Elegí retiro o envío en el siguiente paso.</p></Summary></div></>
}

export function Checkout() {
  const { demo } = useCatalog()
  const requestKey = useRef('')
  const { user } = useAuth()
  const { cart, lines } = useCart()
  const [customer, setCustomer] = useState<Customer>({ name: '', email: '', phone: '', delivery: 'pickup', address: '', city: '', notes: '' })
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [savedExample, setSavedExample] = useState('')
  const [paymentEnabled, setPaymentEnabled] = useState(false)
  useEffect(() => { let active = true; api<{ enabled: boolean }>('/api/payments/config').then(data => { if (active) setPaymentEnabled(data.enabled) }).catch(() => {}); return () => { active = false } }, [])
  const result = useRef<HTMLDivElement>(null)
  useEffect(() => { if (step === 2) result.current?.focus() }, [step])
  if (!cart.length) return <Empty/>
  function change(key: keyof Customer, value: string) { setCustomer(prev => ({ ...prev, [key]: value })); setPreview(false); setSavedExample(''); requestKey.current = crypto.getRandomValues(new Uint8Array(32)).reduce((s, n) => s + n.toString(16).padStart(2, '0'), '') }
  async function pay(saveOnly = false) {
    setBusy(true); setError('')
    try {
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({items:lines,customer,user:user?.id}))))).map(n=>n.toString(16).padStart(2,'0')).join('')
      let cached
      try {cached=JSON.parse(sessionStorage.getItem('oscal-checkout-attempt') || 'null')} catch { /* Storage optional. */ }
      requestKey.current=cached?.digest===digest && /^[a-f0-9]{64}$/.test(cached.key) ? cached.key : crypto.getRandomValues(new Uint8Array(32)).reduce((s,n)=>s+n.toString(16).padStart(2,'0'),'')
      try {sessionStorage.setItem('oscal-checkout-attempt',JSON.stringify({digest,key:requestKey.current}))} catch { /* Retry during this page remains supported. */ }
      if (demo || saveOnly) {
        const saved = await api<{ id: string; token: string }>('/api/orders', 'POST', { items: lines, customer, requestKey: requestKey.current })
        sessionStorage.setItem(`oscal-order-${saved.id}`, saved.token)
        setSavedExample(saved.id)
        setPreview(true); return
      }
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lines, customer, requestKey: requestKey.current }) , signal: AbortSignal.timeout(20000) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos iniciar el pago.')
      sessionStorage.setItem(`oscal-order-${data.id}`, data.token)
      window.location.assign(data.url)
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos conectar. Intentá nuevamente.') }
    finally { setBusy(false) }
  }
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setStep(2) }
  return <><Link to="/carrito" className="text-sm">← Volver al carrito</Link><h1 className={`${title} mt-6`}>Un paso más cerca.</h1><ol className="my-8 flex flex-wrap gap-6 text-sm" aria-label="Pasos del pedido">{['Tus datos y entrega', 'Resumen y pago'].map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? 'font-semibold' : 'text-[#72737e]'}><span className="mr-2 inline-grid size-8 place-items-center rounded-full border border-[#292d4b30]">0{i + 1}</span>{label}</li>)}</ol>
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]"><div className="rounded-2xl border border-[#292d4b15] bg-white p-6 sm:p-9">{step === 1 ? <form onSubmit={submit}><h3 className="mb-6 text-xl font-medium">Empecemos por vos.</h3>{user ? <button type="button" className="mb-6 text-sm underline" onClick={() => setCustomer(prev => ({ ...prev, name: user.name, email: user.email, phone: user.address.phone || prev.phone, address: user.address.street || prev.address, city: user.address.city || prev.city }))}>Usar mis datos guardados</button> : <p className="mb-6 text-sm text-[#72737e]"><Link to="/ingresar?next=/checkout" className="underline">Ingresá a tu cuenta</Link> para ver este pedido en tu historial, o continuá como invitado.</p>}<div className="grid gap-5 sm:grid-cols-2">{([{ key: 'name', label: 'Nombre y apellido', type: 'text', auto: 'name' }, { key: 'email', label: 'Correo electrónico', type: 'email', auto: 'email' }, { key: 'phone', label: 'Teléfono de contacto', type: 'tel', auto: 'tel' }] as const).map(f => <label key={f.key} className="text-sm">{f.label}<input name={f.key} type={f.type} autoComplete={f.auto} required maxLength={120} pattern={f.type === 'text' ? '.*\\S.*' : undefined} className={field} value={customer[f.key]} onChange={e => change(f.key, e.target.value)}/></label>)}</div>
      <fieldset className="mt-8"><legend className="mb-4 text-lg">¿Cómo querés recibirlo?</legend><div className="grid gap-3 sm:grid-cols-2">{(['pickup', 'delivery'] as const).map(mode => <label key={mode} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${customer.delivery === mode ? 'border-[#292d4b] bg-[#f8f6ef]' : 'border-[#292d4b20]'}`}><input className="mt-1 accent-[#292d4b]" type="radio" name="delivery" checked={customer.delivery === mode} onChange={() => change('delivery', mode)}/><span className="text-sm font-medium">{mode === 'pickup' ? 'Retirar en el local' : 'Consultar envío'}<small className="mt-2 block text-xs leading-5 font-normal text-[#72737e]">{mode === 'pickup' ? 'Arenal Grande 2178 · Sin costo' : 'Confirmamos cobertura y costo antes de cobrar.'}</small></span></label>)}</div></fieldset>
      {customer.delivery === 'delivery' && <div className="mt-5 grid gap-5 sm:grid-cols-2"><label className="text-sm">Dirección<input className={field} autoComplete="street-address" value={customer.address} onChange={e => change('address', e.target.value)} required pattern=".*\S.*" maxLength={180}/></label><label className="text-sm">Localidad y departamento<input className={field} autoComplete="address-level2" value={customer.city} onChange={e => change('city', e.target.value)} required pattern=".*\S.*" maxLength={120}/></label></div>}
      <label className="mt-6 block text-sm">Comentarios <span className="text-[#72737e]">(opcional)</span><textarea className={field} maxLength={500} rows={3} value={customer.notes} onChange={e => change('notes', e.target.value)} placeholder="Algo que debamos saber sobre tu pedido…"/></label><button type="submit" className={`${primary} mt-7 w-full`}>Revisar mi pedido →</button>
    </form> : <div ref={result} tabIndex={-1} className="outline-none"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-medium">Todo en orden.</h3><button className="text-sm underline" onClick={() => { setStep(1); setPreview(false) }}>Editar datos</button></div><dl className="mt-6 space-y-5 text-sm"><div><dt className="mb-1 text-[#72737e]">Contacto</dt><dd>{customer.name}<br/>{customer.email}<br/>{customer.phone}</dd></div><div><dt className="mb-1 text-[#72737e]">Entrega</dt><dd>{customer.delivery === 'pickup' ? 'Retiro en Arenal Grande 2178, Montevideo' : `${customer.address}, ${customer.city}`}</dd></div>{customer.notes && <div><dt className="mb-1 text-[#72737e]">Comentarios</dt><dd className="break-words">{customer.notes}</dd></div>}</dl>
      <div className="mt-8 rounded-2xl bg-[#f3f7fa] p-5"><p className="text-base font-semibold">Mercado Pago</p><p className="mt-1 text-xs text-[#646573]">Tarjetas de crédito y débito · Medios habilitados por Mercado Pago Uruguay</p><p className="mt-2 text-sm leading-6 text-[#646573]">{customer.delivery === 'delivery' ? 'Primero confirmamos el costo del envío. El pago se habilita con el total acordado.' : 'Completá el pago en Mercado Pago con los medios disponibles para tu cuenta.'}</p></div>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <button disabled={busy || !!savedExample} className={`${primary} mt-6 w-full`} onClick={() => pay(true)}>{busy ? 'Guardando…' : savedExample ? 'Pedido guardado ✓' : demo ? 'Guardar pedido de ejemplo →' : customer.delivery === 'delivery' ? 'Enviar pedido y solicitar cotización →' : 'Enviar pedido →'}</button>
      {!demo && customer.delivery === 'pickup' && paymentEnabled && !savedExample && <button disabled={busy || !user?.verified} className={`${primary} mt-3 w-full`} onClick={() => pay()}>{user?.verified ? 'Pagar ahora con Mercado Pago ↗' : 'Confirmá tu correo para pagar online'}</button>}
      {!demo && <p className="mt-3 text-xs leading-5 text-[#72737e]">Al enviar el pedido queda pendiente de confirmación, sin cobro ni reserva de stock. El local coordina disponibilidad{customer.delivery === 'delivery' ? ' y envío' : ''} antes del pago.</p>}
      {preview && <div role="status" className="mt-5 rounded-2xl border border-[#61714d40] bg-[#edf0e7] p-5"><strong>{demo ? 'Pedido de ejemplo guardado.' : 'Recibimos tu pedido.'}</strong><p className="mt-2 break-all text-xs">Referencia: {savedExample}</p><p className="mt-2 text-sm leading-6">{demo ? 'Guardado en la base de datos para probar el recorrido. No es una compra real ni se realizó un cobro.' : 'Pendiente de confirmación. No se realizó ningún cobro.'}</p><Link to={`/pedido?order=${savedExample}`} className="mt-4 block text-sm underline">Consultar estado del pedido ↗</Link>{user && <Link to="/cuenta" className="mt-3 block text-sm underline">Ver mis pedidos ↗</Link>}</div>}
      <p className="mt-4 text-xs leading-5 text-[#72737e]">{demo ? 'Demostración · No ingreses datos de tarjeta.' : 'Los datos de tu tarjeta se ingresan únicamente en Mercado Pago.'}</p>
    </div>}</div><Summary delivery={customer.delivery}/></div></>
}

export function PaymentResult() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const id = params.get('order') || ''
  const [message, setMessage] = useState('Consultá el estado de tu pedido. Un pedido recibido todavía no confirma un pago.')
  const [busy, setBusy] = useState(false)
  async function verify() {
    setBusy(true)
    try {
      const token = sessionStorage.getItem(`oscal-order-${id}`)
      if (!token && !user) throw new Error('Ingresá a tu cuenta para consultar este pedido o abrí esta página desde el navegador usado para comprar.')
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}?payment_id=${encodeURIComponent(params.get('payment_id') || '')}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No pudimos verificar el pago.')
      setMessage(data.status === 'demo' ? 'Pedido de ejemplo guardado. No es una compra real y no se realizó ningún cobro.' : data.status === 'received' ? 'Pedido recibido. Pendiente de confirmar disponibilidad y coordinar el pago.' : data.status === 'awaiting_shipping' ? 'Pedido recibido. Pendiente de cotizar el envío y confirmar disponibilidad antes del pago.' : data.status === 'approved' ? 'Pago aprobado y verificado. Conservá la referencia de tu pedido para coordinar el retiro.' : data.status === 'rejected' ? 'El pago fue rechazado. Tu carrito sigue disponible para volver a intentarlo.' : `Estado del pedido: ${data.status}. Podés volver a consultar en unos instantes.`)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No pudimos verificar el pago.') }
    finally { setBusy(false) }
  }
  return <div className="mx-auto max-w-xl py-14 text-center"><h1 className={title}>Tu pedido en Oscal.</h1><p className="mt-7 leading-7" role="status">{message}</p>{id && <p className="mt-4 break-all text-xs text-[#72737e]">Referencia: {id}</p>}<button className={`${primary} mt-8`} disabled={busy || !id} onClick={verify}>{busy ? 'Verificando…' : 'Consultar estado'}</button><Link className="mt-6 block text-sm underline" to="/carrito">Volver al carrito</Link></div>
}



