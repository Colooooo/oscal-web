export type LocationPosition = { lat: number; lng: number }

export function directionsUrl(position: LocationPosition) {
  return `https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`
}
