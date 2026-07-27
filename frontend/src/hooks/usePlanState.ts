import { useState, useCallback } from 'react'
import type { Route } from '../services/api'

// 'corridor': the planner picks the pubs between start and end
// 'select': the user picks the pubs, the planner only orders them
export type PlanMode = 'corridor' | 'select'

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
  mode: PlanMode
  selectedPubIds: string[]
}

const initialState: PlanState = {
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
  mode: 'corridor',
  selectedPubIds: [],
}

export const usePlanState = () => {
  const [state, setState] = useState<PlanState>(initialState)

  const setStartPoint = useCallback((coords: [number, number]) => {
    setState((prev) => ({
      ...prev,
      startPoint: coords,
    }))
  }, [])

  const setEndPoint = useCallback((coords: [number, number] | null) => {
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

  // Switching mode drops any planned route: the two modes produce routes from
  // different inputs, so keeping the old one on screen would be misleading.
  const setMode = useCallback((mode: PlanMode) => {
    setState((prev) => ({
      ...prev,
      mode,
      route: null,
      // In select mode the map's clicks go to pub selection once the start is
      // placed, so never leave it waiting for an end point.
      selectingEnd: mode === 'select' ? false : prev.selectingEnd,
    }))
  }, [])

  const setSelectedPubIds = useCallback((pubIds: string[]) => {
    setState((prev) => ({
      ...prev,
      selectedPubIds: pubIds,
    }))
  }, [])

  const togglePubSelection = useCallback((pubId: string) => {
    setState((prev) => ({
      ...prev,
      selectedPubIds: prev.selectedPubIds.includes(pubId)
        ? prev.selectedPubIds.filter((id) => id !== pubId)
        : [...prev.selectedPubIds, pubId],
    }))
  }, [])

  const clearForm = useCallback(() => {
    setState((prev) => ({ ...initialState, mode: prev.mode }))
  }, [])

  return {
    state,
    setStartPoint,
    setEndPoint,
    setRoute,
    setNumPubs,
    setSelectingStart,
    setSelectingEnd,
    setMode,
    setSelectedPubIds,
    togglePubSelection,
    clearForm,
  }
}
