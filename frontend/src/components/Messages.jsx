import React, { useEffect, useState } from 'react'
import { Snackbar, Alert } from '@mui/material'

const Messages = ({ message, type }) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      if (type === 'success') {
        const timer = setTimeout(() => setVisible(false), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [message, type])

  const handleClose = () => {
    setVisible(false)
  }

  return (
    <Snackbar
      open={visible && !!message}
      autoHideDuration={type === 'success' ? 3000 : null}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={handleClose}
        severity={type === 'error' ? 'error' : 'success'}
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  )
}

export default Messages
