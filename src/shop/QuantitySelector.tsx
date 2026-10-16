// Adapted from Ferreteria-pro/src/components/QuantitySelector.jsx.
export default function QuantitySelector({ quantity, max, label, onChange }: { quantity: number; max: number; label: string; onChange: (n: number) => void }) {
  return <div className="inline-flex items-center rounded-full border border-[#292d4b30] bg-white">
    <button type="button" className="size-10 disabled:opacity-30" disabled={quantity <= 1} aria-label={`Reducir cantidad de ${label}`} onClick={() => onChange(quantity - 1)}>−</button>
    <input className="w-12 bg-transparent text-center text-sm" type="number" min={1} max={max} step={1} value={quantity} aria-label={`Cantidad de ${label}`} onChange={e => onChange(Math.min(max, Math.max(1, Math.floor(Number(e.target.value) || 1))))}/>
    <button type="button" className="size-10 disabled:opacity-30" disabled={quantity >= max} aria-label={`Aumentar cantidad de ${label}`} onClick={() => onChange(quantity + 1)}>+</button>
  </div>
}
