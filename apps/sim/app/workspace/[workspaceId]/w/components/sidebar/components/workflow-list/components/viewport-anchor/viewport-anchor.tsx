'use client'

import { type ComponentPropsWithoutRef, forwardRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ViewportAnchorProps extends Omit<ComponentPropsWithoutRef<'div'>, 'style'> {
  /** Viewport coordinates, as read from a pointer event or `getBoundingClientRect()`. */
  position: { x: number; y: number }
}

/**
 * A 1px, non-interactive anchor placed at viewport coordinates, for menus opened from a pointer
 * position rather than from a trigger element.
 *
 * Rendered into `document.body`: the workflows list lives inside a popover whose content is
 * positioned with a transform, and a transformed ancestor becomes the containing block for
 * `position: fixed` descendants. Left in place, the anchor would resolve its coordinates against
 * the popover instead of the viewport and the menu would open offset from the clicked button.
 *
 * Mounted after hydration so the server markup, which has no body to portal into, still matches.
 */
export const ViewportAnchor = forwardRef<HTMLDivElement, ViewportAnchorProps>(
  function ViewportAnchor({ position, ...props }, ref) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
      setMounted(true)
    }, [])

    if (!mounted) return null

    return createPortal(
      <div
        {...props}
        ref={ref}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '1px',
          height: '1px',
          pointerEvents: 'none',
        }}
      />,
      document.body
    )
  }
)
