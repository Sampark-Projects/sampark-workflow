import { useRef, useState } from 'react'
import type { PanelFloatRect } from '@/stores/panel'

const MIN_WIDTH = 280
const MIN_HEIGHT = 240
const VIEWPORT_GAP = 8

/** Where the panel lands the first time it is detached: the docked panel's slot, lifted off the edge. */
export function getDefaultFloatRect(width: number): PanelFloatRect {
  const top = 64
  return clampFloatRect({
    x: window.innerWidth - width - 16,
    y: top,
    width,
    height: window.innerHeight - top - 16,
  })
}

/**
 * Keeps a floating window inside the viewport and above its minimum size, so a saved
 * rectangle from a larger window can never strand the panel off screen.
 */
export function clampFloatRect(rect: PanelFloatRect): PanelFloatRect {
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), window.innerWidth - VIEWPORT_GAP * 2)
  const height = Math.min(Math.max(rect.height, MIN_HEIGHT), window.innerHeight - VIEWPORT_GAP * 2)
  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, VIEWPORT_GAP), window.innerWidth - width - VIEWPORT_GAP),
    y: Math.min(Math.max(rect.y, VIEWPORT_GAP), window.innerHeight - height - VIEWPORT_GAP),
  }
}

interface Interaction {
  kind: 'drag' | 'resize'
  startX: number
  startY: number
  origin: PanelFloatRect
}

/**
 * Drag and resize for the floating panel window.
 *
 * The rectangle follows the pointer through local state and is committed to the store once
 * on release, so a drag does not write to persisted storage on every move. Pointer capture
 * keeps the gesture alive when the cursor leaves the handle.
 */
export function useFloatingPanel(rect: PanelFloatRect, onCommit: (rect: PanelFloatRect) => void) {
  const [live, setLive] = useState<PanelFloatRect | null>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const liveRef = useRef<PanelFloatRect | null>(null)

  const begin = (kind: Interaction['kind']) => (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    if (kind === 'drag' && (event.target as HTMLElement).closest('button, a, input, [role=button]'))
      return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      kind,
      startX: event.clientX,
      startY: event.clientY,
      origin: clampFloatRect(rect),
    }
  }

  const move = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current
    if (!interaction) return
    const dx = event.clientX - interaction.startX
    const dy = event.clientY - interaction.startY
    const { origin } = interaction
    const next = clampFloatRect(
      interaction.kind === 'drag'
        ? { ...origin, x: origin.x + dx, y: origin.y + dy }
        : { ...origin, width: origin.width + dx, height: origin.height + dy }
    )
    liveRef.current = next
    setLive(next)
  }

  const end = (event: React.PointerEvent<HTMLElement>) => {
    if (!interactionRef.current) return
    interactionRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (liveRef.current) onCommit(liveRef.current)
    liveRef.current = null
    setLive(null)
  }

  const handlersFor = (kind: Interaction['kind']) => ({
    onPointerDown: begin(kind),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  })

  return {
    // The window does not exist while rendering on the server, where the rectangle is unused.
    rect: live ?? (typeof window === 'undefined' ? rect : clampFloatRect(rect)),
    dragHandlers: handlersFor('drag'),
    resizeHandlers: handlersFor('resize'),
  }
}
