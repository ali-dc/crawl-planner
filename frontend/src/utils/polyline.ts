import * as polyline from '@mapbox/polyline'

/**
 * Decode a polyline string to an array of [longitude, latitude] coordinates
 * @param encoded - Encoded polyline string
 * @returns Array of [lng, lat] coordinate pairs
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded) {
    return []
  }

  try {
    // polyline.decode returns [lat, lng] pairs, but we use [lng, lat]
    const latLngCoords = polyline.decode(encoded, 5) as [number, number][]
    // Convert to [lng, lat] for consistency with our codebase
    return latLngCoords.map(([lat, lng]: [number, number]) => [lng, lat])
  } catch (error) {
    console.error('Error decoding polyline:', error)
    return []
  }
}
