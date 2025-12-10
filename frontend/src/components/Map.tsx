/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useState } from 'react'
import { useMediaQuery, useTheme } from '@mui/material'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createStartMarkerElement, createEndMarkerElement } from '../utils/markerIcons'
import { decodePolyline } from '../utils/polyline'
import type { Route } from '../services/api'
import bristolBoundaryUrl from '../assets/bristol_boundary.geojson?url'

const BRISTOL_CENTER: [number, number] = [-2.5879, 51.4545]

interface MapProps {
  startPoint: [number, number] | null
  endPoint: [number, number] | null
  route: Route | null
  onMapClick: (coords: [number, number]) => void
  selectingStart: boolean
  selectingEnd: boolean
}

const Map: React.FC<MapProps> = ({
  startPoint,
  endPoint,
  route,
  onMapClick,
  selectingStart,
  selectingEnd,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const startMarkerRef = useRef<maplibregl.Marker | null>(null)
  const endMarkerRef = useRef<maplibregl.Marker | null>(null)
  const pubMarkersRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return

    if (map.current) return // prevent re-initialization

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: BRISTOL_CENTER,
      zoom: 13,
    })

    map.current.on('load', async () => {
      // Add Bristol city boundary
      const boundarySource = 'bristol-boundary-source'
      const boundaryLayer = 'bristol-boundary-layer'

      try {
        if (!map.current!.getSource(boundarySource)) {
          const response = await fetch(bristolBoundaryUrl)
          const boundaryData = await response.json()

          map.current!.addSource(boundarySource, {
            type: 'geojson',
            data: boundaryData,
          })

          map.current!.addLayer({
            id: boundaryLayer,
            type: 'line',
            source: boundarySource,
            paint: {
              'line-color': '#aaaaaa',
              'line-width': 2,
              'line-opacity': 1,
            },
          })
        }
      } catch (error) {
        console.warn('Could not load Bristol boundary:', error)
      }

      setIsMapReady(true)
    })

    // Register click handler - only process if in selection mode
    const handleMapClickEvent = (e: maplibregl.MapLayerMouseEvent | maplibregl.MapMouseEvent) => {
      // Only process map clicks if we're actively selecting start or end points
      if (selectingStart || selectingEnd) {
        const { lng, lat } = (e as maplibregl.MapMouseEvent).lngLat
        onMapClick([lng, lat])
      }
    }

    map.current.on('click', handleMapClickEvent as unknown as (e: maplibregl.MapLayerMouseEvent) => void)

    // Add a separate listener to the map canvas to close popups on background clicks
    const mapCanvas = map.current.getCanvas()
    const handleCanvasClick = (e: MouseEvent) => {
      // Check if the click was on a marker (pub-marker-* elements)
      const target = e.target as HTMLElement
      if (target && target.className && typeof target.className === 'string' && target.className.startsWith('pub-marker-')) {
        return // Let the marker handle it
      }

      // Close popup when clicking on map background
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
    }

    mapCanvas.addEventListener('click', handleCanvasClick)

    return () => {
      if (map.current) {
        // Don't destroy the map on cleanup, just remove event listeners
        // map.current.remove() would cause issues on re-render
      }
    }
  }, [onMapClick, selectingStart, selectingEnd])

  // Manage start/end markers
  useEffect(() => {
    if (!map.current || !isMapReady) return

    // Remove old start marker
    if (startMarkerRef.current) {
      startMarkerRef.current.remove()
      startMarkerRef.current = null
    }

    // Add start point marker if it exists
    if (startPoint) {
      const startEl = createStartMarkerElement()
      startMarkerRef.current = new maplibregl.Marker({ element: startEl })
        .setLngLat(startPoint)
        .addTo(map.current)
    }
  }, [startPoint, isMapReady])

  // Manage end marker
  useEffect(() => {
    if (!map.current || !isMapReady) return

    // Remove old end marker
    if (endMarkerRef.current) {
      endMarkerRef.current.remove()
      endMarkerRef.current = null
    }

    // Add end point marker if it exists
    if (endPoint) {
      const endEl = createEndMarkerElement()
      endMarkerRef.current = new maplibregl.Marker({ element: endEl })
        .setLngLat(endPoint)
        .addTo(map.current)
    }
  }, [endPoint, isMapReady])

  // Manage pub markers - only recreate when route changes
  useEffect(() => {
    if (!map.current || !isMapReady) return

    // Remove old pub markers
    pubMarkersRef.current.forEach((marker) => {
      try {
        marker.remove()
      } catch {
        // Already removed
      }
    })
    pubMarkersRef.current = []

    // Add pub markers if route exists
    if (route && route.pubs) {
      route.pubs.forEach((pub, index) => {
        const pubEl = document.createElement('div')
        pubEl.className = `pub-marker-${pub.pub_id}`
        pubEl.style.cssText = `
          width: 32px;
          height: 32px;
          background: #667eea;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `
        pubEl.textContent = String(index + 1)

        pubEl.addEventListener('click', (e) => {
          e.stopPropagation()

          // Close existing popup if clicking a different pub
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }

          // Create and show popup
          const popupContent = document.createElement('div')
          popupContent.style.cssText = `
            padding: 8px 12px;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
          `
          popupContent.textContent = pub.pub_name

          popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
            .setLngLat([pub.longitude, pub.latitude])
            .setDOMContent(popupContent)
            .addTo(map.current!)
        })

        if (map.current) {
          const pubMarker = new maplibregl.Marker({ element: pubEl })
            .setLngLat([pub.longitude, pub.latitude])
            .addTo(map.current)
          pubMarkersRef.current.push(pubMarker)
        }
      })
    }
  }, [route, isMapReady])

  // Clear route visualization
  useEffect(() => {
    if (!map.current || !isMapReady) return

    // Clear existing route layers and sources
    if (map.current) {
      const existingLayers = map.current
        .getStyle()
        .layers.filter((layer) => layer.id.startsWith('route-'))
      existingLayers.forEach((layer) => {
        map.current!.removeLayer(layer.id)
      })

      const existingSources = map.current.getStyle().sources
      Object.keys(existingSources).forEach((sourceId) => {
        if (sourceId.startsWith('route-source-')) {
          map.current!.removeSource(sourceId)
        }
      })
    }

    // Draw route polylines if available
    if (route && route.legs && route.legs.length > 0) {
      const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316']

      route.legs.forEach((leg, legIndex) => {
        // Try to use encoded polyline first, fall back to raw geometry
        let coordinates: [number, number][] | null = null

        if (leg.geometry_encoded) {
          coordinates = decodePolyline(leg.geometry_encoded)
        } else if (leg.geometry && leg.geometry.coordinates) {
          coordinates = leg.geometry.coordinates
        }

        if (!coordinates || coordinates.length === 0) {
          console.warn(`Leg ${legIndex} has no valid geometry`)
          return
        }

        const layerId = `route-leg-${legIndex}`
        const sourceId = `route-source-${legIndex}`

        try {
          // Check if source already exists
          if (!map.current!.getSource(sourceId)) {
            map.current!.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'LineString',
                coordinates: coordinates,
              },
            })
          }

          // Check if layer already exists
          if (!map.current!.getLayer(layerId)) {
            map.current!.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': colors[legIndex % colors.length],
                'line-width': 3,
                'line-opacity': 0.8,
              },
            })
          }
        } catch (error) {
          console.error(`Error adding route leg ${legIndex}:`, error)
        }
      })

      // Fit bounds to all points, accounting for the sidebar on the right (desktop only)
      const bounds = new maplibregl.LngLatBounds()
      if (startPoint) bounds.extend(startPoint)
      if (endPoint) bounds.extend(endPoint)
      if (route.pubs) {
        route.pubs.forEach((pub) => {
          bounds.extend([pub.longitude, pub.latitude])
        })
      }
      // Use responsive padding: right padding only on desktop where sidebar is visible
      if (map.current) {
        const rightPadding = isMobile ? 50 : 450
        map.current.fitBounds(bounds, {
          padding: { top: 50, bottom: isMobile ? 120 : 50, left: 50, right: rightPadding },
          maxZoom: 15,
        })
      }
    }
  }, [route, isMapReady, isMobile, startPoint, endPoint])

  return (
    <div
      ref={mapContainer}
      style={{
        width: '100%',
        height: '100%',
        cursor: selectingStart || selectingEnd ? 'crosshair' : 'grab',
      }}
    />
  )
}

export default Map
