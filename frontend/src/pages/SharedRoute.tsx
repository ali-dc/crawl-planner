import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, Box, CircularProgress, Typography, Button, Paper } from '@mui/material'
import Map from '../components/Map'
import Header from '../components/Header'
import ResultsPanel from '../components/ResultsPanel'
import Messages from '../components/Messages'
import Loading from '../components/Loading'
import { apiClient, SharedRoute as SharedRouteData } from '../services/api'
import theme from '../theme'

function SharedRoute() {
  const { shareId } = useParams<{ shareId: string }>()
  const navigate = useNavigate()
  const [sharedRoute, setSharedRoute] = useState<SharedRouteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    const loadRoute = async () => {
      console.log('Attempting to load shared route with shareId:', shareId)

      if (!shareId) {
        console.error('No shareId provided')
        setMessage('Invalid share ID', 'error')
        setLoading(false)
        return
      }

      try {
        console.log(`Fetching route from /routes/${shareId}`)
        const route = await apiClient.getSharedRoute(shareId)
        console.log('Successfully loaded route:', route)
        setSharedRoute(route)
        setMessage('Route loaded successfully!', 'success')
      } catch (error) {
        console.error('Error loading shared route:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('Full error details:', { error, errorMessage })
        setMessage(`Error: ${errorMessage}`, 'error')
      } finally {
        setLoading(false)
      }
    }

    loadRoute()
  }, [shareId])

  const handleBackClick = () => {
    navigate('/')
  }

  const handleShareClick = () => {
    if (sharedRoute) {
      const currentUrl = window.location.href
      navigator.clipboard.writeText(currentUrl)
      setMessage('Share URL copied to clipboard!', 'success')
    }
  }

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    )
  }

  if (!sharedRoute) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            padding: 2,
          }}
        >
          <Typography variant="h5">Route not found</Typography>
          <Button variant="contained" onClick={handleBackClick}>
            Back to Planner
          </Button>
        </Box>
      </ThemeProvider>
    )
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
        <Header startPoint={sharedRoute.start_point} endPoint={sharedRoute.end_point} />

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
              startPoint={[sharedRoute.start_point.longitude, sharedRoute.start_point.latitude]}
              endPoint={[sharedRoute.end_point.longitude, sharedRoute.end_point.latitude]}
              route={{
                pubs: sharedRoute.pubs || [],
                total_distance_meters: sharedRoute.total_distance_meters,
                estimated_time_minutes: sharedRoute.estimated_time_minutes,
                num_pubs: sharedRoute.num_pubs,
                legs: sharedRoute.legs,
              }}
            />
          </Box>

          <ResultsPanel
            route={{
              pubs: sharedRoute.pubs || [],
              total_distance_meters: sharedRoute.total_distance_meters,
              estimated_time_minutes: sharedRoute.estimated_time_minutes,
              num_pubs: sharedRoute.num_pubs,
              legs: sharedRoute.legs,
            }}
            visible={true}
            onClose={handleBackClick}
            startPoint={[sharedRoute.start_point.longitude, sharedRoute.start_point.latitude]}
            endPoint={[sharedRoute.end_point.longitude, sharedRoute.end_point.latitude]}
            numPubs={sharedRoute.num_pubs}
            onRefresh={() => {}}
            loading={false}
            isSharedRoute={true}
            onShare={handleShareClick}
          />
        </Box>

        <Messages message={message} type={messageType} />
        <Loading loading={loading} />
      </Box>
    </ThemeProvider>
  )
}

export default SharedRoute
