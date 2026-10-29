'use client'

import { type RefObject, useState } from 'react'
import { Chip, OverflowText, Popover, PopoverContent, PopoverTrigger, Skeleton } from '@sim/emcn'
import { ChevronDown, Workflow } from '@sim/emcn/icons'
import { WorkflowList } from '@/app/workspace/[workspaceId]/w/components/sidebar/components/workflow-list'
import type { WorkflowMetadata } from '@/stores/workflows/registry/types'

const MENU_MAX_HEIGHT = 480
const MENU_MIN_WIDTH = 280

interface WorkflowsMenuProps {
  workspaceId: string
  workflowId: string | undefined
  regularWorkflows: WorkflowMetadata[]
  /** True while workflows or the session are still loading. */
  isLoading: boolean
  canReorder: boolean
  /** Attached to the menu's scroll region so drag-reorder can auto-scroll it. */
  scrollContainerRef: RefObject<HTMLDivElement | null>
}

/**
 * The workflow tree as a dropdown in the top bar. Hosts the same {@link WorkflowList}
 * the left rail rendered, so folders, drag-reorder, and context menus are unchanged.
 * Selecting a workflow closes it.
 */
export function WorkflowsMenu({
  workspaceId,
  workflowId,
  regularWorkflows,
  isLoading,
  canReorder,
  scrollContainerRef,
}: WorkflowsMenuProps) {
  const [open, setOpen] = useState(false)
  const selectedWorkflow = workflowId
    ? regularWorkflows.find((workflow) => workflow.id === workflowId)
    : undefined

  /**
   * Captured, because workflow rows stop propagation of their own clicks. Row buttons
   * (the "more" menu) sit inside the link and must not dismiss the dropdown.
   */
  const handleContentClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('a') && !target.closest('button')) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Chip leftIcon={Workflow} rightIcon={ChevronDown} aria-label='Select workflow'>
          <OverflowText
            label={selectedWorkflow?.name ?? 'Select workflow'}
            className='max-w-[220px]'
          />
        </Chip>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side='bottom'
        sideOffset={8}
        minWidth={MENU_MIN_WIDTH}
        maxHeight={MENU_MAX_HEIGHT}
        border
        className='p-0'
      >
        <div
          ref={scrollContainerRef}
          onClickCapture={handleContentClickCapture}
          className='flex max-h-[inherit] flex-col overflow-y-auto overflow-x-hidden p-2'
        >
          {isLoading && regularWorkflows.length === 0 ? (
            <div className='flex h-[30px] items-center px-2'>
              <Skeleton className='h-[16px] w-[120px] rounded-sm' />
            </div>
          ) : (
            <WorkflowList
              workspaceId={workspaceId}
              workflowId={workflowId}
              regularWorkflows={regularWorkflows}
              isLoading={isLoading}
              canReorder={canReorder}
              scrollContainerRef={scrollContainerRef}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
