import { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
  Divider,
} from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'
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
}

const DesktopResults: React.FC<DesktopResultsProps> = ({ route, visible }) => {
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
      }}
    >
      <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon color="primary" />
          Your Route
        </Typography>
        <RouteStats distance={distance} time={time} />
        <PubsList route={route} />
      </Box>
    </Paper>
  )
}

interface MobileResultsProps {
  route: Route | null
  visible: boolean
}

const MobileResults: React.FC<MobileResultsProps> = ({ route, visible }) => {
  const [isOpen, setIsOpen] = useState(true)

  if (!visible || !route) return null

  const distance = (route.total_distance_meters / 1000).toFixed(2)
  const time = Math.round(route.estimated_time_minutes)

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={() => setIsOpen(false)}
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              backgroundColor: 'divider',
              borderRadius: 2,
            }}
          />
        </Box>

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocationOnIcon color="primary" />
          Your Route
        </Typography>

        <RouteStats distance={distance} time={time} />
        <PubsList route={route} />
      </Box>
    </Drawer>
  )
}

interface ResultsPanelProps {
  route: Route | null
  visible: boolean
  onClose: () => void
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ route, visible }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  if (!visible || !route) return null

  return isMobile ? (
    <MobileResults route={route} visible={visible} />
  ) : (
    <DesktopResults route={route} visible={visible} />
  )
}

export default ResultsPanel
