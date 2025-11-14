import { useState, useCallback } from 'react'

export const usePlanState = () => {
  const [state, setState] = useState({
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

  const setStartPoint = useCallback((coords) => {
    setState((prev) => ({
      ...prev,
      startPoint: coords,
    }))
  }, [])

  const setEndPoint = useCallback((coords) => {
    setState((prev) => ({
      ...prev,
      endPoint: coords,
    }))
  }, [])

  const setRoute = useCallback((route) => {
    setState((prev) => ({
      ...prev,
      route,
    }))
  }, [])

  const setNumPubs = useCallback((numPubs) => {
    setState((prev) => ({
      ...prev,
      numPubs,
    }))
  }, [])

  const setSelectingStart = useCallback((selecting) => {
    setState((prev) => ({
      ...prev,
      selectingStart: selecting,
    }))
  }, [])

  const setSelectingEnd = useCallback((selecting) => {
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
