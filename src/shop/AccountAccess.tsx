import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, useAuth } from './AuthContext'
export default function AccountAccess() {
  const auth=useAuth()
  const [link] = useState(()=>{const params=new URLSearchParams(window.location.hash.slice(1)); const reset=params.get('reset'); return {purpose:reset?'reset':params.has('verify')?'verify':'recover',token:reset || params.get('verify') || ''}})
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [message,setMessage]=useState(''), [busy,setBusy]=useState(false), [done,setDone]=useState(false)
  async function submit(e:FormEvent) {
    e.preventDefault();setBusy(true);setMessage('')
    try {const result=await api<{message:string}>(`/api/auth/${link.purpose}`,'POST',{email,password,token:link.token});if(link.purpose==='verify') await auth.refresh();setMessage(result.message);setPassword('');setDone(true);window.history.replaceState(null,'','/acceso')}
    catch(e){setMessage(e instanceof Error?e.message:'No pudimos completar la solicitud.')}
    finally{setBusy(false)}
  }
  return <form onSubmit={submit} className="mx-auto my-10 max-w-md rounded-3xl bg-white p-8"><h1 className="mb-6 text-3xl tracking-tight">{link.purpose==='reset'?'Elegí una contraseña nueva':link.purpose==='verify'?'Confirmá tu correo':'Recuperá tu cuenta'}</h1>{!done && <>{link.purpose==='recover' && <label className="block text-sm">Correo electrónico<input type="email" autoComplete="email" required maxLength={120} className="mt-3 w-full rounded-xl border p-3" value={email} onChange={e=>setEmail(e.target.value)}/></label>}{link.purpose==='reset' && <label className="block text-sm">Nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-3 w-full rounded-xl border p-3" value={password} onChange={e=>setPassword(e.target.value)}/></label>}<button disabled={busy} className="mt-6 w-full rounded-full bg-[#292d4b] p-4 text-sm text-white disabled:opacity-40">{busy?'Un momento…':link.purpose==='verify'?'Confirmar correo':link.purpose==='reset'?'Actualizar contraseña':'Enviar enlace de recuperación'}</button></>}<p role="status" className="mt-5 text-sm leading-6">{message}</p><Link to="/ingresar" className="mt-5 block text-sm underline">Volver a ingresar</Link></form>
}
