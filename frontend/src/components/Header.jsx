import { AppBar, Toolbar, Typography, Chip, Box } from '@mui/material'
import { IoBeer } from 'react-icons/io5'

const Header = ({ startPoint, endPoint }) => {
  const getBarStatus = () => {
    if (!startPoint) return 'Select a start point'
    if (!endPoint) return 'Select an end point'
    return 'Ready to plan'
  }

  const statusColor = startPoint && endPoint ? 'success' : 'default'

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <IoBeer style={{ marginRight: 16, fontSize: 28 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
          Bristol Pub Crawl Planner
        </Typography>
        <Chip
          label={getBarStatus()}
          color={statusColor}
          variant="outlined"
          sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: 'white' }}
        />
      </Toolbar>
    </AppBar>
  )
}

export default Header
