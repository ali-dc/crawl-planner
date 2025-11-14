import { useState, useCallback, useRef, useEffect } from 'react'
import Map from './components/Map'
import Header from './components/Header'
import BottomBar from './components/BottomBar'
import ResultsPanel from './components/ResultsPanel'
import Messages from './components/Messages'
import Loading from './components/Loading'
import { usePlanState } from './hooks/usePlanState'
import { apiClient } from './services/api'

function App() {
  const {
    state,
    setStartPoint,
    setEndPoint,
    setRoute,
    setNumPubs,
    setSelectingStart,
    setSelectingEnd,
    clearForm,
  } = usePlanState()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState(null)

  // Use refs to track state for map click handler
  const selectingStartRef = useRef(true)
  const selectingEndRef = useRef(false)

  // Update refs when state changes
  useEffect(() => {
    selectingStartRef.current = state.selectingStart
    selectingEndRef.current = state.selectingEnd
  }, [state.selectingStart, state.selectingEnd])

  // Handle map clicks for start/end point selection
  const handleMapClick = useCallback(([lng, lat]) => {
    if (selectingStartRef.current) {
      setStartPoint([lng, lat])
      setSelectingStart(false)
      setSelectingEnd(true)
      showMessage('Start location selected', 'success')
    } else if (selectingEndRef.current) {
      setEndPoint([lng, lat])
      setSelectingEnd(false)
      showMessage('End location selected', 'success')
    }
  }, [])


  const showMessage = (msg, type) => {
    setMessage(msg)
    setMessageType(type)
  }

  const handlePlan = async () => {
    if (!state.startPoint || !state.endPoint) {
      showMessage('Please select both start and end locations', 'error')
      return
    }

    setLoading(true)

    try {
      const route = await apiClient.planCrawl(
        state.startPoint,
        state.endPoint,
        state.numPubs,
        0.5,
        true
      )
      setRoute(route)
      showMessage('Route planned successfully!', 'success')
    } catch (error) {
      console.error('Error planning route:', error)
      showMessage(`Error: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    clearForm()
    showMessage(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <Header startPoint={state.startPoint} endPoint={state.endPoint} />

      <div
        style={{
          display: 'flex',
          flex: 1,
          gap: 0,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
        }}
        className="container"
      >
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: '#e0e0e0',
            minHeight: 0,
            minWidth: 0,
            width: '100%',
          }}
          className="map-container"
        >
          <Map
            startPoint={state.startPoint}
            endPoint={state.endPoint}
            route={state.route}
            onMapClick={handleMapClick}
            numPubs={state.numPubs}
            selectingStart={state.selectingStart}
            selectingEnd={state.selectingEnd}
          />
        </div>

        <ResultsPanel
          route={state.route}
          visible={state.route !== null}
          onClose={handleClear}
        />
      </div>

      <BottomBar
        startPoint={state.startPoint}
        endPoint={state.endPoint}
        numPubs={state.numPubs}
        onNumPubsChange={setNumPubs}
        onPlan={handlePlan}
        onClear={handleClear}
        loading={loading}
      />

      <Messages message={message} type={messageType} />
      <Loading loading={loading} />
    </div>
  )
}

export default App
