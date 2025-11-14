import React from 'react'

const BottomBar = ({
  startPoint,
  endPoint,
  numPubs,
  onNumPubsChange,
  onPlan,
  onClear,
  loading,
}) => {
  const getBarStatus = () => {
    if (!startPoint) return 'Select a start point'
    if (!endPoint) return 'Select an end point'
    return 'Ready to plan'
  }

  return (
    <div className="mobile-bottom-bar">
      <div className="bar-controls">
        <input
          type="number"
          className="pubs-input"
          min="1"
          max="20"
          value={numPubs}
          onChange={(e) => onNumPubsChange(parseInt(e.target.value))}
        />
        <button
          className="btn-plan"
          onClick={onPlan}
          disabled={!startPoint || !endPoint || loading}
        >
          Plan
        </button>
        <button
          className="btn-clear"
          onClick={onClear}
          title="Clear all selections"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export default BottomBar
