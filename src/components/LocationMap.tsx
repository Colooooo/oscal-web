import { useEffect, useRef, useState } from 'react'
import type { Map as VectorMap, Marker, MapMouseEvent } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import './LocationMap.css'
import { directionsUrl } from '../config/location'
import type { LocationPosition } from '../config/location'

function readPosition(fields: { lat: string; lng: string }): LocationPosition | null {
  if (!fields.lat.trim() || !fields.lng.trim()) return null
  const lat = Number(fields.lat)
  const lng = Number(fields.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 85 && Math.abs(lng) <= 180
    ? { lat, lng } : null
}

function locationFields(position: LocationPosition) {
  return { lat: String(position.lat), lng: String(position.lng) }
}

export default function LocationMap({ position, onSave }: {
  position: LocationPosition
  onSave: (position: LocationPosition) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<VectorMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const initialPosition = useRef(position)
  const [editing, setEditing] = useState(false)
  const [fields, setFields] = useState(() => locationFields(position))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [tileError, setTileError] = useState(false)
  const [mapRevision, setMapRevision] = useState(0)

  useEffect(() => {
    const element = container.current
    if (!element) return
    let disposed = false
    let initialized = false
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || initialized) return
      initialized = true
      observer.disconnect()
      async function loadBasemap() {
        const [{ Map, Marker, Popup, NavigationControl, AttributionControl, setWorkerUrl }] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ])
        if (disposed || !element) return
        setWorkerUrl(workerUrl)
        const point = initialPosition.current
        const instance = new Map({
          container: element,
          style: '/oscal-map-dark.json',
          center: [point.lng, point.lat], zoom: 16, minZoom: 2, maxZoom: 18,
          scrollZoom: true, dragRotate: false, pitchWithRotate: false,
          touchPitch: false, attributionControl: false,
          locale: { 'NavigationControl.ZoomIn': 'Acercar mapa', 'NavigationControl.ZoomOut': 'Alejar mapa' },
        })
        map.current = instance
        instance.touchZoomRotate.disableRotation()
        instance.scrollZoom.setWheelZoomRate(1 / 600)
        instance.scrollZoom.setZoomRate(1 / 120)
        instance.addControl(new NavigationControl({ showCompass: false }), 'top-right')
        instance.addControl(new AttributionControl({ compact: false }))
        instance.on('error', () => { if (!disposed) setTileError(true) })
        const pin = document.createElement('button')
        pin.type = 'button'
        pin.className = 'oscal-map-marker'
        pin.title = 'Oscal Importaciones — Arenal Grande 2178'
        pin.setAttribute('aria-label', 'Ubicación de Oscal Importaciones')
        pin.innerHTML = '<span class="oscal-pin"><span class="oscal-pin-dot"></span><span class="oscal-pin-label"><img src="/oscal-logo.svg" alt="Oscal" width="581" height="261"></span></span>'
        marker.current = new Marker({ element: pin, anchor: 'center' })
          .setLngLat([point.lng, point.lat])
          .setPopup(new Popup({ offset: 24, closeButton: false, className: 'oscal-map-tooltip' })
            .setHTML('<strong>Oscal Importaciones</strong><span>Arenal Grande 2178</span>'))
          .addTo(instance)
        setMapRevision(revision => revision + 1)
      }
      void loadBasemap().catch(() => {
        if (!disposed) setTileError(true)
      })
    })
    observer.observe(element)
    const resize = new ResizeObserver(() => map.current?.resize())
    resize.observe(element)
    return () => {
      disposed = true
      observer.disconnect()
      resize.disconnect()
      marker.current?.remove()
      map.current?.remove()
      map.current = null
      marker.current = null
    }
  }, [])

  useEffect(() => {
    initialPosition.current = position
    marker.current?.setLngLat([position.lng, position.lat])
  }, [position])

  useEffect(() => {
    const instance = map.current
    const pin = marker.current
    if (!instance || !pin) return
    pin.setDraggable(editing)
    const movePin = (event: MapMouseEvent) => {
      if (event.originalEvent.target instanceof Element && event.originalEvent.target.closest('.oscal-map-marker')) return
      setFields(locationFields({ lat: Number(event.lngLat.lat.toFixed(7)), lng: Number(event.lngLat.lng.toFixed(7)) }))
    }
    const dragPin = () => {
      const point = pin.getLngLat()
      setFields(locationFields({ lat: Number(point.lat.toFixed(7)), lng: Number(point.lng.toFixed(7)) }))
    }
    if (editing) {
      instance.on('click', movePin)
      pin.on('dragend', dragPin)
    }
    return () => {
      instance.off('click', movePin)
      pin.off('dragend', dragPin)
    }
  }, [editing, mapRevision])

  useEffect(() => {
    const point = readPosition(fields)
    if (editing && point) marker.current?.setLngLat([point.lng, point.lat])
  }, [editing, fields, mapRevision])

  function recenter() {
    const point = (editing && readPosition(fields)) || position
    map.current?.easeTo({ center: [point.lng, point.lat], zoom: 16, duration: 450 })
  }

  function cancelEdit() {
    setEditing(false)
    setMessage('')
    marker.current?.setLngLat([position.lng, position.lat])
    map.current?.easeTo({ center: [position.lng, position.lat], zoom: 16, duration: 450 })
  }

  async function savePosition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const point = readPosition(fields)
    if (!point) {
      setMessage('Ingresá una latitud y una longitud válidas.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/__oscal/location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(point),
      })
      if (!response.ok) throw new Error('save failed')
      onSave(point)
      setEditing(false)
      setMessage('Ubicación guardada en el proyecto. También se usará al publicar.')
    } catch {
      setMessage('No se pudo guardar. Comprobá que la landing esté abierta con npm run dev e intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return <div className={`location-map-card${editing ? ' is-editing' : ''}`}>
    <div className="location-map-header">
      <div><span className="eyebrow">ENCONTRANOS ACÁ</span><h3>Arenal Grande 2178<span>.</span></h3></div>
      <span className="location-map-city">Montevideo, Uruguay</span>
    </div>
    <div className="location-map-frame">
      <div ref={container} className="location-map-canvas" role="region" aria-label="Mapa interactivo de Oscal en Arenal Grande 2178, Montevideo" />
      <button className="location-map-recenter" type="button" onClick={recenter} aria-label="Volver a la ubicación de Oscal" title="Centrar en Oscal"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="currentColor" strokeWidth="1.6"/></svg></button>
      {tileError && <div className="location-map-error" role="status">No pudimos cargar todas las calles. Podés abrir la ubicación en Google Maps desde el botón de abajo.</div>}
    </div>
    <div className="location-map-footer"><p>Mové el mapa y usá el scroll para acercarte o alejarte.</p><a href={directionsUrl(position)} target="_blank" rel="noreferrer">Cómo llegar <span aria-hidden="true">↗</span></a></div>
    {import.meta.env.DEV && <div className="location-map-settings">
      {!editing && <button type="button" className="location-edit-toggle" onClick={() => { setFields(locationFields(position)); setEditing(true); setMessage('') }}>Ajustar ubicación <span aria-hidden="true">↗</span></button>}
      {editing && <form onSubmit={savePosition} className="location-editor">
        <div className="location-editor-heading"><h4>Ubicá la entrada del local</h4><p>Arrastrá el marcador o tocá el punto exacto en el mapa. También podés ingresar las coordenadas.</p></div>
        <div className="location-coordinate-fields"><label>Latitud<input type="number" step="any" min="-85" max="85" required value={fields.lat} onChange={event => setFields({ ...fields, lat: event.target.value })}/></label><label>Longitud<input type="number" step="any" min="-180" max="180" required value={fields.lng} onChange={event => setFields({ ...fields, lng: event.target.value })}/></label></div>
        <div className="location-editor-actions"><button type="button" onClick={recenter}>Ver el punto</button><button type="button" onClick={cancelEdit} disabled={saving}>Cancelar</button><button className="location-save" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ubicación'}</button></div>
      </form>}
      <p className="location-editor-status" role="status" aria-live="polite">{message}</p>
    </div>}
  </div>
}
