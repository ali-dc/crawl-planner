import React, { useEffect, useState } from 'react'

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

  if (!visible || !message) return null

  const className = type === 'error' ? 'error-message' : 'success-message'

  return (
    <div className={`${className} show`}>{message}</div>
  )
}

export default Messages
