import React from 'react'
import {
  Paper,
  Box,
  TextField,
  Button,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'

const BottomBar = ({
  startPoint,
  endPoint,
  numPubs,
  onNumPubsChange,
  onPlan,
  onClear,
  loading,
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mt: 'auto',
        backgroundColor: '#f5f5f5',
        borderTop: '1px solid #e0e0e0',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 2,
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'center',
        }}
      >
        <TextField
          type="number"
          inputProps={{ min: 1, max: 20 }}
          value={numPubs}
          onChange={(e) => onNumPubsChange(parseInt(e.target.value))}
          label="Number of Pubs"
          size="small"
          sx={{
            width: isMobile ? '100%' : 120,
            '& .MuiInputBase-root': {
              backgroundColor: 'white',
            },
          }}
        />

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} sx={{ width: isMobile ? '100%' : 'auto' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<DirectionsWalkIcon />}
            onClick={onPlan}
            disabled={!startPoint || !endPoint || loading}
            fullWidth={isMobile}
            size={isMobile ? 'medium' : 'small'}
          >
            {loading ? 'Planning...' : 'Plan'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ClearIcon />}
            onClick={onClear}
            fullWidth={isMobile}
            size={isMobile ? 'medium' : 'small'}
          >
            Clear
          </Button>
        </Stack>
      </Box>
    </Paper>
  )
}

export default BottomBar
