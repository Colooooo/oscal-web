/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { Product } from './store'
import { api } from './AuthContext'

type CatalogData = { products: Product[]; demo: boolean; categories: {name:string;count:number}[]; total:number; page:number; pages:number }
const empty:CatalogData = {products:[],demo:true,categories:[],total:0,page:1,pages:1}
const Context = createContext<(CatalogData & { pageProducts:Product[]; loading:boolean; initialLoading:boolean; cartReady:boolean; error:string; reload:()=>void }) | null>(null)
export function CatalogProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const enabled=['/catalogo','/carrito','/checkout'].includes(location.pathname)
  const request = !enabled ? '' : location.pathname==='/catalogo' ? `/api/catalog${location.search}` : '/api/catalog/selection'
  const [state,setState] = useState({key:'',data:empty,products:[] as Product[],error:''})
  useEffect(() => {
    if (!request) return
    let active=true
    let ids:string[]=[]
    try { const lines:unknown=JSON.parse(localStorage.getItem('oscal-cart-v1') || '[]'); if (Array.isArray(lines)) ids=lines.slice(0,100).flatMap(p=>typeof p?.id==='string' ? [p.id] : []) } catch { /* Optional storage. */ }
    const selection=`/api/catalog/selection?ids=${encodeURIComponent(ids.join(','))}`
    const page=request.startsWith('/api/catalog?') || request==='/api/catalog' ? api<CatalogData>(request) : Promise.resolve(empty)
    Promise.all([page,api<{products:Product[];demo:boolean}>(selection)]).then(([data,cart]) => {
      if (active) setState({key:request,data:{...data,demo:cart.demo},products:[...new Map([...cart.products,...data.products].map(p=>[p.id,p])).values()],error:''})
    }).catch(() => { if(active) setState({key:request,data:empty,products:[],error:'No pudimos cargar el catálogo. Comprobá la conexión e intentá nuevamente.'}) })
    return () => {active=false}
  },[request])
  return <Context.Provider value={{...state.data,products:state.products,pageProducts:state.data.products,loading:enabled && state.key!==request,initialLoading:enabled && !state.key,cartReady:enabled && state.key===request && !state.error,error:state.key===request ? state.error : '',reload:()=>window.location.reload()}}>{children}</Context.Provider>
}
export function useCatalog() {const value=useContext(Context); if(!value) throw new Error('CatalogProvider missing'); return value}
