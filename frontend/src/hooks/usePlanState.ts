import { useState, useCallback } from 'react'
import type { Route } from '../services/api'

interface PlanState {
  startPoint: [number, number] | null
  endPoint: [number, number] | null
  selectingStart: boolean
  selectingEnd: boolean
  route: Route | null
  markers: {
    start: unknown
    end: unknown
    pubs: unknown[]
  }
  popups: {
    start: unknown
    end: unknown
    pubs: unknown[]
  }
  routePolylines: unknown[]
  numPubs: number
}

export const usePlanState = () => {
  const [state, setState] = useState<PlanState>({
    startPoint: null,
    endPoint: null,
    selectingStart: true,
    selectingEnd: false,
    route: null,
    markers: {
      start: null,
      end: null,
      pubs: [],
    },
    popups: {
      start: null,
      end: null,
      pubs: [],
    },
    routePolylines: [],
    numPubs: 5,
  })

  const setStartPoint = useCallback((coords: [number, number]) => {
    setState((prev) => ({
      ...prev,
      startPoint: coords,
    }))
  }, [])

  const setEndPoint = useCallback((coords: [number, number]) => {
    setState((prev) => ({
      ...prev,
      endPoint: coords,
    }))
  }, [])

  const setRoute = useCallback((route: Route | null) => {
    setState((prev) => ({
      ...prev,
      route,
    }))
  }, [])

  const setNumPubs = useCallback((numPubs: number) => {
    setState((prev) => ({
      ...prev,
      numPubs,
    }))
  }, [])

  const setSelectingStart = useCallback((selecting: boolean) => {
    setState((prev) => ({
      ...prev,
      selectingStart: selecting,
    }))
  }, [])

  const setSelectingEnd = useCallback((selecting: boolean) => {
    setState((prev) => ({
      ...prev,
      selectingEnd: selecting,
    }))
  }, [])

  const clearForm = useCallback(() => {
    setState({
      startPoint: null,
      endPoint: null,
      selectingStart: true,
      selectingEnd: false,
      route: null,
      markers: {
        start: null,
        end: null,
        pubs: [],
      },
      popups: {
        start: null,
        end: null,
        pubs: [],
      },
      routePolylines: [],
      numPubs: 5,
    })
  }, [])

  return {
    state,
    setStartPoint,
    setEndPoint,
    setRoute,
    setNumPubs,
    setSelectingStart,
    setSelectingEnd,
    clearForm,
  }
}
