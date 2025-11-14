import React from 'react'

const Header = ({ startPoint, endPoint }) => {
  const getBarStatus = () => {
    if (!startPoint) return 'Select a start point'
    if (!endPoint) return 'Select an end point'
    return 'Ready to plan'
  }

  return (
    <div className="sidebar-header">
      <h1>🍺 Pub Crawl</h1>
      <div id="barStatus">{getBarStatus()}</div>
    </div>
  )
}

export default Header
