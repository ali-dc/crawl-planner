import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, Box } from '@mui/material'
import Map from './components/Map'
import Header from './components/Header'
import BottomBar from './components/BottomBar'
import ResultsPanel from './components/ResultsPanel'
import Messages from './components/Messages'
import Loading from './components/Loading'
import { usePlanState } from './hooks/usePlanState'
import { apiClient } from './services/api'
import theme from './theme'

function App() {
  const navigate = useNavigate()
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
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [uniformityWeight] = useState(0.5)

  // Use refs to track state for map click handler
  const selectingStartRef = useRef(true)
  const selectingEndRef = useRef(false)

  // Update refs when state changes
  useEffect(() => {
    selectingStartRef.current = state.selectingStart
    selectingEndRef.current = state.selectingEnd
  }, [state.selectingStart, state.selectingEnd])

  // Handle map clicks for start/end point selection
  const handleMapClick = useCallback(([lng, lat]: [number, number]) => {
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
  }, [setStartPoint, setEndPoint, setSelectingStart, setSelectingEnd])

  const showMessage = (msg: string, type: 'success' | 'error') => {
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
        uniformityWeight,
        true
      )
      setRoute(route)
      setIsSaved(false)
      showMessage('Route planned successfully!', 'success')
    } catch (error) {
      console.error('Error planning route:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showMessage(`Error: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRoute = async () => {
    if (!state.route || !state.startPoint || !state.endPoint) {
      showMessage('No route to save', 'error')
      return
    }

    setLoading(true)

    try {
      const saveRequest = {
        start_point: {
          longitude: state.startPoint[0],
          latitude: state.startPoint[1],
        },
        end_point: {
          longitude: state.endPoint[0],
          latitude: state.endPoint[1],
        },
        route_indices: state.route.route_indices || [],
        selected_pub_ids: state.route.pubs.map((pub) => pub.pub_id),
        num_pubs: state.route.num_pubs || state.numPubs,
        uniformity_weight: uniformityWeight,
        total_distance_meters: state.route.total_distance_meters,
        estimated_time_minutes: state.route.estimated_time_minutes,
        legs: state.route.legs,
      }

      const savedRoute = await apiClient.saveRoute(saveRequest)
      setIsSaved(true)
      showMessage('Route saved!', 'success')
      navigate(`/routes/${savedRoute.share_id}`)
    } catch (error) {
      console.error('Error saving route:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showMessage(`Error saving route: ${errorMessage}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    clearForm()
    setMessage(null)
    setIsSaved(false)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100%',
        }}
      >
        <Header startPoint={state.startPoint} endPoint={state.endPoint} />

        <Box
          sx={{
            display: 'flex',
            flex: 1,
            gap: 0,
            minHeight: 0,
            minWidth: 0,
            width: '100%',
            overflow: 'visible',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              backgroundColor: '#e0e0e0',
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <Map
              startPoint={state.startPoint}
              endPoint={state.endPoint}
              route={state.route}
              onMapClick={handleMapClick}
              selectingStart={state.selectingStart}
              selectingEnd={state.selectingEnd}
            />
          </Box>

          <ResultsPanel
            route={state.route}
            visible={state.route !== null}
            onClose={handleClear}
            startPoint={state.startPoint}
            endPoint={state.endPoint}
            numPubs={state.numPubs}
            onRefresh={handlePlan}
            loading={loading}
            onSave={handleSaveRoute}
            isSaved={isSaved}
            isSharedRoute={false}
          />
        </Box>

        {/* Show BottomBar only when no route is planned (on mobile, MobileResults replaces it) */}
        {!state.route && (
          <BottomBar
            startPoint={state.startPoint}
            endPoint={state.endPoint}
            numPubs={state.numPubs}
            onNumPubsChange={setNumPubs}
            onPlan={handlePlan}
            onClear={handleClear}
            loading={loading}
          />
        )}

        <Messages message={message} type={messageType} />
        <Loading loading={loading} />
      </Box>
    </ThemeProvider>
  )
}

export default App
