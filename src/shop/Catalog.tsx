import { useState } from 'react'
import type { Product } from './store'
import { useSearchParams, Link } from 'react-router-dom'
import { useCatalog } from './CatalogContext'
import { ProductCard, ProductDialog } from './Shop'

export default function Catalog() {
  const [selected,setSelected]=useState<Product|null>(null)
  const { pageProducts:visible, categories, total, page, pages } = useCatalog()
  const [params,setParams]=useSearchParams()
  const query=params.get('q') || '', category=params.get('categoria') || '', sort=params.get('orden') || 'destacados'
  function filter(key:string,value:string) {const next=new URLSearchParams(params); next.delete('page'); if(value) next.set(key,value); else next.delete(key); setParams(next,{replace:true})}
  function changePage(value:number) {const next=new URLSearchParams(params); next.set('page',String(value)); setParams(next); document.getElementById('seleccion')?.scrollIntoView({behavior:'smooth'})}
  return <>
    {selected && <ProductDialog key={selected.id} product={selected} onClose={()=>setSelected(null)}/>}
    <section className="mb-10 grid overflow-hidden rounded-[24px] bg-[#eae5da] md:grid-cols-[1.05fr_1fr]" aria-labelledby="catalog-title">
      <div className="relative px-7 py-10 sm:px-10 sm:py-12">
        <p className="mb-5 flex items-center gap-2 text-[10px] font-medium tracking-[.2em]"><span className="size-1.5 rounded-full bg-[#ed4c55]"/> LA TIENDA DE TUS IDEAS</p>
        <h1 id="catalog-title" className="text-[clamp(42px,5vw,68px)] leading-[1.02] font-medium tracking-[-.055em]">Cosas lindas.<br/><span className="font-['Fraunces_Variable'] font-normal italic text-[#ad424a]">Grandes ideas.</span></h1>
        <p className="mt-5 max-w-72 text-sm leading-6 text-[#68676b]">Para jugar, darle vida a tu casa y hacer de cualquier día una celebración.</p>
        <a href="#seleccion" className="mt-7 inline-flex items-center gap-8 rounded-full bg-[#292d4b] px-5 py-3 text-xs font-medium text-white transition hover:bg-[#b64349]">Descubrí la colección <span>↓</span></a>
      </div>
      <div className="relative min-h-52 overflow-hidden md:min-h-80"><img src="/oscal-hero-1280.webp" srcSet="/oscal-hero-640.webp 640w, /oscal-hero-1280.webp 1280w, /oscal-hero-1920.webp 1920w" sizes="(max-width: 768px) 100vw, 50vw" width="1920" height="1440" fetchPriority="high" alt="Estantes con juguetes y peluches" className="absolute size-full object-cover object-[65%_65%]"/><div className="absolute inset-0 bg-gradient-to-t from-[#292d4b99] to-transparent"/><div className="absolute right-6 bottom-6 left-6 flex items-end justify-between text-white"><p className="text-xs leading-5">Pequeños objetos.<br/><strong className="font-medium">Infinitas posibilidades.</strong></p><span className="text-4xl">↗</span></div></div>
    </section>
    <div id="seleccion" className="grid scroll-mt-28 gap-7 lg:grid-cols-[190px_1fr] lg:gap-10">
      <aside className="h-fit lg:sticky lg:top-32">
        <p className="mb-4 text-[10px] font-semibold tracking-[.18em]">EXPLORÁ POR RUBRO</p>
        <nav aria-label="Filtrar por rubro" className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">{[{name:'',count:categories.reduce((n,c)=>n+c.count,0)},...categories].map(({name:c,count}) => <button key={c} aria-pressed={c===category} onClick={()=>filter('categoria',c)} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-xs transition ${c===category?'bg-[#292d4b] text-white':'hover:bg-[#eae5da]'}`}><span>{c||'Toda la colección'}</span><span className="text-[10px] opacity-60">{count}</span></button>)}</nav>
        <div className="mt-8 hidden border-t border-[#292d4b20] pt-6 lg:block"><p className="font-['Fraunces_Variable'] text-2xl leading-tight">¿Buscás algo<br/>en particular?</p><p className="mt-3 text-xs leading-6 text-[#72737e]">Te ayudamos a encontrarlo.</p><a href="https://wa.me/59894471227" target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs font-semibold text-[#ad424a]">Hablemos ↗</a></div>
      </aside>
      <section aria-label="Productos de la colección">
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-[#292d4b15] pb-5"><label className="relative min-w-48 flex-1"><span className="sr-only">Buscar productos</span><input type="search" value={query} onChange={e=>filter('q',e.target.value)} placeholder="¿Qué estás buscando?" className="w-full rounded-xl border border-[#292d4b15] bg-white px-4 py-3 text-sm"/></label><label><span className="sr-only">Ordenar productos</span><select value={sort} onChange={e=>filter('orden',e.target.value)} className="max-w-full rounded-xl bg-transparent px-2 py-3 text-xs"><option value="destacados">Destacados</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option></select></label></div>
        <div className="mb-5 flex items-baseline justify-between gap-3"><h2 className="text-xl font-medium tracking-tight">{category||'La colección'}</h2><p role="status" className="text-[11px] text-[#72737e]">{total} productos · UYU</p></div>
        {visible.length ? <div className="grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 xl:grid-cols-3">{visible.map(p=><ProductCard key={p.id} product={p} onSelect={setSelected}/>)}</div> : <div className="rounded-xl border border-dashed border-[#292d4b30] px-6 py-20 text-center"><p>No encontramos productos con esos filtros.</p><button onClick={()=>setParams({})} className="mt-5 text-sm underline">Limpiar filtros</button></div>}
        {pages>1 && <nav aria-label="Páginas del catálogo" className="mt-9 flex items-center justify-center gap-5"><button disabled={page<=1} onClick={()=>changePage(page-1)} className="rounded-full border px-5 py-2 text-sm disabled:opacity-30">← Anterior</button><span className="text-xs">{page} de {pages}</span><button disabled={page>=pages} onClick={()=>changePage(page+1)} className="rounded-full border px-5 py-2 text-sm disabled:opacity-30">Siguiente →</button></nav>}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-5 border-t border-[#292d4b20] pt-6"><p className="text-xs text-[#72737e]">Elegí tus favoritos. El resto, paso a paso.</p><Link to="/carrito" className="text-sm font-medium">Revisar mi bolsa ↗</Link></div>
      </section>
    </div>
  </>
}
