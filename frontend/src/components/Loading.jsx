import React from 'react'
import { Backdrop, CircularProgress, Box, Typography } from '@mui/material'

const Loading = ({ loading }) => {
  return (
    <Backdrop
      sx={{
        color: '#fff',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
      open={loading}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <CircularProgress color="inherit" size={60} />
        <Typography variant="h6" sx={{ color: 'white' }}>
          Planning your route...
        </Typography>
      </Box>
    </Backdrop>
  )
}

export default Loading
