import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, useAuth } from './AuthContext'
import { money } from './store'
const inputClass = 'mt-2 w-full rounded-xl border border-[#292d4b25] bg-white px-4 py-3 text-sm'
const buttonClass = 'rounded-full bg-[#292d4b] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#b64349] disabled:opacity-50'

export function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') === '/checkout' ? '/checkout' : '/cuenta'
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (auth.loading) return <p role="status" className="py-20 text-center">Cargando tu cuenta…</p>
  if (auth.user) return <Navigate to={next} replace/>
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await auth.authenticate(mode, form); setForm({ name: '', email: '', password: '' }); navigate(next, { replace: true }) }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos ingresar.') }
    finally { setBusy(false) }
  }
  return <div className="mx-auto my-8 grid max-w-4xl overflow-hidden rounded-3xl border border-[#292d4b15] bg-white md:grid-cols-2"><div className="bg-[#eae5da] p-8 sm:p-12"><p className="text-[10px] tracking-[.2em]">TU ESPACIO EN OSCAL</p><h1 className="mt-6 text-4xl leading-tight tracking-tight">Tus ideas.<br/><span className="font-['Fraunces_Variable'] italic text-[#ad424a]">En un solo lugar.</span></h1><p className="mt-6 text-sm leading-7 text-[#72737e]">Guardá tu dirección, revisá tus pedidos y volvé por tus próximos favoritos.</p><p className="mt-8 text-xs leading-6 text-[#72737e]">Tu cuenta de Oscal es independiente de Mercado Pago. Al pagar, completás los datos de tarjeta directamente con el proveedor.</p></div><form className="p-8 sm:p-12" onSubmit={submit}><h2 className="mb-6 text-2xl font-medium">{mode === 'login' ? 'Qué bueno verte.' : 'Creá tu cuenta.'}</h2>{mode === 'register' && <label className="mb-5 block text-sm">Nombre y apellido<input required maxLength={80} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass}/></label>}<label className="mb-5 block text-sm">Correo electrónico<input required type="email" autoComplete="email" maxLength={120} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass}/></label><label className="block text-sm">Contraseña<input required type="password" minLength={12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inputClass}/></label><p className="mt-2 text-xs text-[#72737e]">Al menos 12 caracteres.</p>{error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}<button disabled={busy} className={`${buttonClass} mt-7 w-full`}>{busy ? 'Un momento…' : mode === 'login' ? 'Ingresar →' : 'Crear cuenta →'}</button><button type="button" className="mt-5 w-full text-sm underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setForm({ ...form, password: '' }) }}>{mode === 'login' ? '¿Primera vez? Creá tu cuenta' : 'Ya tengo cuenta'}</button><Link to="/acceso" className="mt-5 block text-center text-sm underline">Olvidé mi contraseña</Link></form></div>
}

type Order = { id: string; total: number; status: string; created: string; items: { title: string; quantity: number }[] }
export function Account() {
  const auth = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!auth.user) return
    let active = true
    api<{ orders: Order[] }>('/api/account/orders').then(data => { if (active) setOrders(data.orders) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setOrdersLoading(false) })
    return () => { active = false }
  }, [auth.user])
  if (auth.loading) return <p role="status">Cargando tu cuenta…</p>
  if (!auth.user) return <Navigate to="/ingresar" replace/>
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setFeedback(''); setBusy(true)
    const data = new FormData(event.currentTarget)
    try { await auth.saveAddress({ phone: String(data.get('phone')), street: String(data.get('street')), city: String(data.get('city')) }); setFeedback('Dirección guardada.') }
    catch (e) { setError(e instanceof Error ? e.message : 'No pudimos guardar.') }
    finally { setBusy(false) }
  }
  return <div className="py-6"><div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs tracking-widest">MI CUENTA</p><h1 className="mt-3 text-4xl tracking-tight">Hola, {auth.user.name}.</h1><p className="mt-3 text-sm text-[#72737e]">{auth.user.email}</p></div><button className="text-sm underline" onClick={() => { auth.logout().catch(e => setError(e.message)) }}>Cerrar sesión</button></div>{error && <p role="alert" className="mb-5 text-sm text-red-700">{error}</p>}<div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-[#292d4b20] p-5"><p className="text-sm">{auth.user.verified?'Correo confirmado ✓':'Tu correo todavía no está confirmado.'}</p>{!auth.user.verified && <button className="text-sm underline" onClick={()=>{api<{message:string}>('/api/auth/send-verification','POST',{}).then(data=>setFeedback(data.message)).catch(e=>setError(e.message))}}>Enviar enlace de confirmación</button>}<button className="text-sm underline" onClick={()=>{auth.logoutAll().catch(e=>setError(e.message))}}>Cerrar todas las sesiones</button></div><div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]"><section><h2 className="mb-5 text-2xl font-medium">Tus pedidos</h2>{ordersLoading ? <p role="status">Cargando pedidos…</p> : !orders.length ? <div className="rounded-2xl border border-dashed border-[#292d4b30] p-8"><p>Todavía no tenés pedidos.</p><Link className="mt-5 inline-block text-sm underline" to="/catalogo">Explorar catálogo ↗</Link></div> : <div className="space-y-4">{orders.map(order => <article key={order.id} className="rounded-2xl border border-[#292d4b15] bg-white p-6"><div className="flex justify-between gap-4 text-sm"><span>{new Date(order.created).toLocaleDateString('es-UY')}</span><strong>{money(order.total)}</strong></div><p className="mt-3 text-xs font-medium text-[#ad424a]">{({ demo: 'Ejemplo · sin cobro', received: 'Recibido · pendiente de confirmación', awaiting_shipping: 'Pendiente de cotización de envío', approved: 'Pago aprobado', pending: 'Pendiente de pago', rejected: 'Pago rechazado', needs_review: 'En revisión', refunded: 'Reembolsado', cancelled: 'Cancelado', in_process: 'Pago en proceso' } as Record<string, string>)[order.status] || 'En revisión'}</p><ul className="my-4 space-y-2 text-sm text-[#72737e]">{order.items.map((item, i) => <li key={i}>{item.quantity} × {item.title}</li>)}</ul><p className="break-all text-[10px] text-[#72737e]">{order.id}</p>{order.status !== 'demo' && <Link className="mt-4 inline-block text-sm underline" to={`/pedido?order=${order.id}`}>Consultar estado ↗</Link>}</article>)}</div>}</section><form key={auth.user.id} onSubmit={save} className="h-fit rounded-2xl bg-[#eae5da] p-7"><h2 className="mb-5 text-2xl font-medium">Tu dirección</h2>{([{ name: 'phone', label: 'Teléfono', auto: 'tel' }, { name: 'street', label: 'Dirección', auto: 'street-address' }, { name: 'city', label: 'Localidad y departamento', auto: 'address-level2' }] as const).map(f => <label key={f.name} className="mb-4 block text-sm">{f.label}<input name={f.name} autoComplete={f.auto} maxLength={f.name === 'street' ? 180 : f.name === 'phone' ? 40 : 120} defaultValue={auth.user?.address[f.name] || ''} className={inputClass}/></label>)}<button disabled={busy} className={`${buttonClass} mt-3 w-full`}>{busy ? 'Guardando…' : 'Guardar dirección'}</button><p role="status" className="mt-4 text-sm">{feedback}</p></form></div></div>
}
