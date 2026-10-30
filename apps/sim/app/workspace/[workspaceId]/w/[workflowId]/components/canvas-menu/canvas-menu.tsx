'use client'

import type { RefObject } from 'react'
import { Popover, PopoverAnchor, PopoverContent, PopoverDivider, PopoverItem } from '@sim/emcn'

/**
 * Props for CanvasMenu component
 */
export interface CanvasMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  menuRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onUndo: () => void
  onRedo: () => void
  onPaste: () => void
  onAutoLayout: () => void
  onFitToView: () => void
  onOpenSearchReplace: () => void
  onToggleVariables: () => void
  onToggleWorkflowLock?: () => void
  isVariablesOpen?: boolean
  hasClipboard?: boolean
  disableEdit?: boolean
  canAdmin?: boolean
  canUndo?: boolean
  canRedo?: boolean
  isInvitationsDisabled?: boolean
  /** Whether the workflow has locked blocks (disables auto-layout) */
  hasLockedBlocks?: boolean
  /** Whether all blocks in the workflow are locked */
  allBlocksLocked?: boolean
  /** Whether the workflow has any blocks */
  hasBlocks?: boolean
}

/**
 * Context menu for workflow canvas.
 * Displays canvas-level actions when right-clicking empty space.
 */
export function CanvasMenu({
  isOpen,
  position,
  menuRef,
  onClose,
  onUndo,
  onRedo,
  onPaste,
  onAutoLayout,
  onFitToView,
  onOpenSearchReplace,
  onToggleVariables,
  onToggleWorkflowLock,
  isVariablesOpen = false,
  hasClipboard = false,
  disableEdit = false,
  canAdmin = false,
  canUndo = false,
  canRedo = false,
  hasLockedBlocks = false,
  allBlocksLocked = false,
  hasBlocks = false,
}: CanvasMenuProps) {
  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()} size='sm'>
      <PopoverAnchor
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '1px',
          height: '1px',
        }}
      />
      <PopoverContent ref={menuRef} align='start' side='bottom' sideOffset={4}>
        {/* History actions */}
        <PopoverItem
          className='group'
          disabled={disableEdit || !canUndo}
          onClick={() => {
            onUndo()
            onClose()
          }}
        >
          <span>Undo</span>
          <span className='ml-auto opacity-70 group-hover:opacity-100'>⌘Z</span>
        </PopoverItem>
        <PopoverItem
          className='group'
          disabled={disableEdit || !canRedo}
          onClick={() => {
            onRedo()
            onClose()
          }}
        >
          <span>Redo</span>
          <span className='ml-auto opacity-70 group-hover:opacity-100'>⌘⇧Z</span>
        </PopoverItem>
        <PopoverItem
          className='group'
          disabled={disableEdit || !hasClipboard}
          onClick={() => {
            onPaste()
            onClose()
          }}
        >
          <span>Paste</span>
          <span className='ml-auto opacity-70 group-hover:opacity-100'>⌘V</span>
        </PopoverItem>

        {/* Edit actions */}
        <PopoverDivider />
        <PopoverItem
          className='group'
          disabled={disableEdit || hasLockedBlocks}
          onClick={() => {
            onAutoLayout()
            onClose()
          }}
          title={hasLockedBlocks ? 'Unlock blocks to use auto-layout' : undefined}
        >
          <span>Auto-layout</span>
          <span className='ml-auto opacity-70 group-hover:opacity-100'>⇧L</span>
        </PopoverItem>
        {canAdmin && onToggleWorkflowLock && (
          <PopoverItem
            disabled={!hasBlocks}
            onClick={() => {
              onToggleWorkflowLock()
              onClose()
            }}
          >
            <span>{allBlocksLocked ? 'Unlock workflow' : 'Lock workflow'}</span>
          </PopoverItem>
        )}
        <PopoverItem
          onClick={() => {
            onFitToView()
            onClose()
          }}
        >
          Fit to View
        </PopoverItem>
      </PopoverContent>
    </Popover>
  )
}
