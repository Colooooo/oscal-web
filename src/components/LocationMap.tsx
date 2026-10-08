import { useEffect, useRef, useState } from 'react'
import type { Map as VectorMap, Marker } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import './LocationMap.css'
import type { LocationPosition } from '../config/location'

export default function LocationMap({ position }: {
  position: LocationPosition
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<VectorMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const initialPosition = useRef(position)
  const [tileError, setTileError] = useState(false)

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
        const [{ Map, Marker, Popup, NavigationControl, setWorkerUrl }] = await Promise.all([
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

  function recenter() {
    map.current?.easeTo({ center: [position.lng, position.lat], zoom: 16, duration: 450 })
  }

  return <div className="location-map-card">
    <div className="location-map-header">
      <div><span className="eyebrow">ENCONTRANOS ACÁ</span><h3>Arenal Grande 2178<span>.</span></h3></div>
      <span className="location-map-city">Montevideo, Uruguay</span>
    </div>
    <div className="location-map-frame">
      <div ref={container} className="location-map-canvas" role="region" aria-label="Mapa interactivo de Oscal en Arenal Grande 2178, Montevideo" />
      <button className="location-map-recenter" type="button" onClick={recenter} aria-label="Volver a la ubicación de Oscal" title="Centrar en Oscal"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="currentColor" strokeWidth="1.6"/></svg></button>
      {tileError && <div className="location-map-error" role="status">No pudimos cargar todas las calles. Podés abrir la ubicación en Google Maps desde «Cómo llegar».</div>}
    </div>
  </div>
}
