import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
  Divider,
  IconButton,
} from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import ShareIcon from '@mui/icons-material/Share'
import type { Route } from '../services/api'

interface RouteStatsProps {
  distance: string
  time: number
}

const RouteStats: React.FC<RouteStatsProps> = ({ distance, time }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
          {distance} km
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Distance
        </Typography>
      </CardContent>
    </Card>
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
          {time} min
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Est. Time
        </Typography>
      </CardContent>
    </Card>
  </Box>
)

interface PubsListProps {
  route: Route
}

const PubsList: React.FC<PubsListProps> = ({ route }) => (
  <List sx={{ width: '100%' }}>
    {route.pubs.map((pub, index) => {
      let legInfo = ''
      // Show the distance/time FROM start TO this pub (leg at index) or FROM previous pub TO this pub
      if (route.legs && route.legs[index]) {
        const leg = route.legs[index]
        const legDistance = (leg.distance_meters / 1000).toFixed(2)
        const legTime = Math.round(leg.duration_seconds / 60)
        legInfo = `${legDistance} km • ${legTime} min`
      }

      return (
        <div key={index}>
          <ListItem
            sx={{
              py: 2,
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemIcon>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'primary.main',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                }}
              >
                {index + 1}
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={pub.pub_name}
              secondary={legInfo || undefined}
              primaryTypographyProps={{ variant: 'body1', fontWeight: 500 }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
          {index < route.pubs.length - 1 && <Divider />}
        </div>
      )
    })}
  </List>
)

interface DesktopResultsProps {
  route: Route | null
  visible: boolean
  onRefresh?: () => void
  onClose?: () => void
  loading?: boolean
  isSharedRoute?: boolean
  onShare?: () => void
}

const DesktopResults: React.FC<DesktopResultsProps> = ({
  route,
  visible,
  onRefresh,
  onClose,
  loading,
  isSharedRoute,
  onShare,
}) => {
  if (!visible || !route) return null

  const distance = (route.total_distance_meters / 1000).toFixed(2)
  const time = Math.round(route.estimated_time_minutes)

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 64,
        right: 0,
        width: 400,
        height: 'calc(100% - 64px)',
        boxSizing: 'border-box',
        overflowY: 'auto',
        zIndex: 1200,
        borderRadius: 0,
        boxShadow: '-2px 0px 8px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOnIcon color="primary" />
            Your Route
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {isSharedRoute && onShare && (
              <IconButton
                size="small"
                onClick={onShare}
                sx={{ color: 'primary.main' }}
                title="Copy share link"
              >
                <ShareIcon />
              </IconButton>
            )}
            {!isSharedRoute && (
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={loading}
                sx={{
                  color: 'primary.main',
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
                title="Refresh with a different route"
              >
                <RefreshIcon />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'error.main' }}
              title={isSharedRoute ? 'Back to planner' : 'Clear route'}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        <RouteStats distance={distance} time={time} />
        <PubsList route={route} />
      </Box>
    </Paper>
  )
}

interface MobileResultsProps {
  route: Route | null
  visible: boolean
  onClose?: () => void
  onRefresh?: () => void
  loading?: boolean
  isSharedRoute?: boolean
  onShare?: () => void
}

const MobileResults: React.FC<MobileResultsProps> = ({
  route,
  visible,
  onClose,
  onRefresh,
  loading,
  isSharedRoute,
  onShare,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!visible || !route) return null

  const distance = (route.total_distance_meters / 1000).toFixed(2)
  const time = Math.round(route.estimated_time_minutes)

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: '0px -2px 8px rgba(0, 0, 0, 0.15)',
        maxHeight: isExpanded ? '85vh' : '120px',
        transition: 'max-height 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with collapse/expand and close buttons */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2,
          borderBottom: '1px solid #e0e0e0',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Your Route
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isSharedRoute && onShare && (
            <IconButton
              size="small"
              onClick={onShare}
              sx={{ color: 'primary.main' }}
              title="Copy share link"
            >
              <ShareIcon />
            </IconButton>
          )}
          {!isSharedRoute && (
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={loading}
              sx={{
                color: 'primary.main',
                animation: loading ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
              title="Refresh with a different route"
            >
              <RefreshIcon />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => setIsExpanded(!isExpanded)}
            sx={{ color: 'primary.main' }}
          >
            {isExpanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </IconButton>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: 'error.main' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Expanded content */}
      {isExpanded && (
        <Box
          sx={{
            overflowY: 'auto',
            flex: 1,
            p: 2,
          }}
        >
          <RouteStats distance={distance} time={time} />
          <PubsList route={route} />
        </Box>
      )}

      {/* Collapsed preview */}
      {!isExpanded && (
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: 'flex',
            gap: 2,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Distance
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {distance} km
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Est. Time
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {time} min
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Pubs
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {route.pubs.length}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}

interface ResultsPanelProps {
  route: Route | null
  visible: boolean
  onClose: () => void
  startPoint?: [number, number] | null
  endPoint?: [number, number] | null
  numPubs?: number
  onRefresh?: () => void
  loading?: boolean
  isSharedRoute?: boolean
  onShare?: () => void
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({
  route,
  visible,
  onClose,
  onRefresh,
  loading,
  isSharedRoute,
  onShare,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  if (!visible || !route) return null

  return isMobile ? (
    <MobileResults
      route={route}
      visible={visible}
      onClose={onClose}
      onRefresh={onRefresh}
      loading={loading}
      isSharedRoute={isSharedRoute}
      onShare={onShare}
    />
  ) : (
    <DesktopResults
      route={route}
      visible={visible}
      onRefresh={onRefresh}
      onClose={onClose}
      loading={loading}
      isSharedRoute={isSharedRoute}
      onShare={onShare}
    />
  )
}

export default ResultsPanel
