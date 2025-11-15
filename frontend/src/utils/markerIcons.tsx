import React from 'react'
import ReactDOM from 'react-dom/client'
import { MdLocationOn } from 'react-icons/md'
import { MdFlag } from 'react-icons/md'

/**
 * Creates a DOM element with a react-icon rendered inside
 * @param IconComponent - The react-icons component to render
 * @param color - CSS color for the icon
 * @param size - Icon size (defaults to 32px)
 * @returns DOM element containing the rendered icon
 */
export const createIconMarkerElement = (
  IconComponent: React.ComponentType,
  color: string,
  size: string = '32px'
): HTMLElement => {
  const container = document.createElement('div')
  container.style.cssText = `
    width: ${size};
    height: ${size};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `

  // Create a root and render the icon component
  const root = ReactDOM.createRoot(container)
  root.render(
    <div style={{ color, fontSize: '32px', display: 'flex' }}>
      <IconComponent />
    </div>
  )

  return container
}

/**
 * Creates a start point marker element
 * @returns HTMLElement
 */
export const createStartMarkerElement = (): HTMLElement => {
  return createIconMarkerElement(MdLocationOn, '#22c55e')
}

/**
 * Creates an end point marker element
 * @returns HTMLElement
 */
export const createEndMarkerElement = (): HTMLElement => {
  return createIconMarkerElement(MdFlag, '#f05c2f')
}
