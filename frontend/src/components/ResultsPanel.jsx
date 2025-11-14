import React, { useState, useEffect } from 'react'

const RouteStats = ({ distance, time }) => (
  <div className="route-stats">
    <div className="stat-card">
      <div className="stat-value">{distance} km</div>
      <div className="stat-label">Distance</div>
    </div>
    <div className="stat-card">
      <div className="stat-value">{time} min</div>
      <div className="stat-label">Est. Time</div>
    </div>
  </div>
)

const PubsList = ({ route }) => (
  <div className="pubs-list">
    {route.pubs.map((pub, index) => {
      let legInfo = ''
      if (route.legs && route.legs[index + 1]) {
        const leg = route.legs[index + 1]
        const legDistance = (leg.distance_meters / 1000).toFixed(2)
        const legTime = Math.round(leg.duration_seconds / 60)
        legInfo = `${legDistance} km • ${legTime} min`
      }

      return (
        <div key={index} className="pub-item">
          <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
            <div className="pub-number">{index + 1}</div>
            <div style={{ flex: 1 }}>
              <div className="pub-name">{pub.pub_name}</div>
              {legInfo && <div className="leg-info">{legInfo}</div>}
            </div>
          </div>
        </div>
      )
    })}
  </div>
)

const DesktopResults = ({ route, visible }) => {
  if (!visible || !route) return null

  const distance = (route.total_distance_meters / 1000).toFixed(2)
  const time = Math.round(route.estimated_time_minutes)

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <div className="results-section">
          <h3>📍 Your Route</h3>
          <RouteStats distance={distance} time={time} />
          <PubsList route={route} />
        </div>
      </div>
    </div>
  )
}

const MobileResults = ({ route, visible }) => {
  const [isMinimized, setIsMinimized] = useState(false)

  if (!visible || !route) return null

  const distance = (route.total_distance_meters / 1000).toFixed(2)
  const time = Math.round(route.estimated_time_minutes)

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  return (
    <div className={`bottom-sheet active ${isMinimized ? 'minimized' : ''}`}>
      <div className="bottom-sheet-header">
        <div className="bottom-sheet-handle"></div>
        {isMinimized && (
          <div style={{ flex: 1, textAlign: 'center', marginRight: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
              📍 {distance} km • {time} min
            </span>
          </div>
        )}
        <button
          className="btn-close-sheet"
          onClick={handleMinimize}
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>
      {!isMinimized && (
        <div className="bottom-sheet-content">
          <div className="results-section">
            <h3>📍 Your Route</h3>
            <RouteStats distance={distance} time={time} />
            <PubsList route={route} />
          </div>
        </div>
      )}
    </div>
  )
}

const ResultsPanel = ({ route, visible, onClose }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!visible || !route) return null

  return isMobile ? (
    <MobileResults route={route} visible={visible} />
  ) : (
    <DesktopResults route={route} visible={visible} />
  )
}

export default ResultsPanel
