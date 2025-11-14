import React from 'react'

const Loading = ({ loading }) => {
  return (
    <>
      {/* Desktop */}
      <div className={`loading ${loading ? 'show' : ''}`}>
        <div className="spinner"></div>
        <p>Planning your route...</p>
      </div>

      {/* Mobile */}
      <div className={`loading ${loading ? 'show' : ''}`}>
        <div className="spinner"></div>
        <p>Planning your route...</p>
      </div>
    </>
  )
}

export default Loading
