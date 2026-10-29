'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  ChipConfirmModal,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Layout,
  MoreHorizontal,
  Tooltip,
  toast,
} from '@sim/emcn'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  Lock,
  PanelRight,
  Unlock,
} from '@sim/emcn/icons'
import { createLogger } from '@sim/logger'
import { useParams, useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import { generateWorkflowJson } from '@/lib/workflows/operations/import-export'
import { useRegisterGlobalCommands } from '@/app/workspace/[workspaceId]/providers/global-commands-provider'
import { useUserPermissionsContext } from '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider'
import { createCommands } from '@/app/workspace/[workspaceId]/utils/commands-utils'
import {
  Editor,
  ItsmSave,
  Toolbar,
} from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components'
import {
  getDefaultFloatRect,
  useFloatingPanel,
} from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/hooks'
import { Variables } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/variables/variables'
import { useAutoLayout } from '@/app/workspace/[workspaceId]/w/[workflowId]/hooks/use-auto-layout'
import { useCurrentWorkflow } from '@/app/workspace/[workspaceId]/w/[workflowId]/hooks/use-current-workflow'
import { getWorkflowLockToggleIds } from '@/app/workspace/[workspaceId]/w/[workflowId]/utils'
import { useDeleteWorkflow, useImportWorkflow } from '@/app/workspace/[workspaceId]/w/hooks'
import { useFolderMap } from '@/hooks/queries/folders'
import { isWorkflowEffectivelyLocked } from '@/hooks/queries/utils/folder-tree'
import { useDuplicateWorkflowMutation, useWorkflowMap } from '@/hooks/queries/workflows'
import { useCollaborativeWorkflow } from '@/hooks/use-collaborative-workflow'
import type { PanelTab } from '@/stores/panel'
import { usePanelStore } from '@/stores/panel'
import { useVariablesStore } from '@/stores/variables/store'
import { getWorkflowWithValues } from '@/stores/workflows'
import { useWorkflowRegistry } from '@/stores/workflows/registry/store'
import { useWorkflowStore } from '@/stores/workflows/workflow/store'

const logger = createLogger('Panel')

/** Names the active tab on the collapsed panel's open button, so it says what it will open. */
const PANEL_TAB_LABELS: Record<PanelTab, string> = {
  toolbar: 'Toolbar',
  editor: 'Editor',
}
/**
 * Panel component with resizable width and tab navigation that persists across page refreshes.
 *
 * Uses a CSS-based approach to prevent hydration mismatches and flash on load:
 * 1. Width is controlled by CSS variable (--panel-width)
 * 2. Blocking script in layout.tsx sets CSS variable and data-panel-active-tab before React hydrates
 * 3. CSS rules control initial visibility based on data-panel-active-tab attribute
 * 4. React takes over visibility control after hydration completes
 * 5. Store updates CSS variable when width changes
 *
 * This ensures server and client render identical HTML, preventing hydration errors and visual flash.
 *
 * Note: All tabs are kept mounted but hidden to preserve component state during tab switches.
 * This prevents unnecessary remounting which would trigger data reloads and reset state.
 *
 * @returns Panel on the right side of the workflow
 */
export const Panel = memo(function Panel() {
  const router = useRouter()
  const params = useParams()
  const workspaceId = params.workspaceId as string

  const panelRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    activeTab,
    setActiveTab,
    _hasHydrated,
    setHasHydrated,
    panelWidth,
    isCollapsed: storedCollapsed,
    toggleCollapsed,
    isFloating: storedFloating,
    floatRect,
    floatPanel,
    setFloatRect,
    dockPanel,
  } = usePanelStore(
    useShallow((state) => ({
      activeTab: state.activeTab,
      setActiveTab: state.setActiveTab,
      _hasHydrated: state._hasHydrated,
      setHasHydrated: state.setHasHydrated,
      panelWidth: state.panelWidth,
      isCollapsed: state.isCollapsed,
      toggleCollapsed: state.toggleCollapsed,
      isFloating: state.isFloating,
      floatRect: state.floatRect,
      floatPanel: state.floatPanel,
      setFloatRect: state.setFloatRect,
      dockPanel: state.dockPanel,
    }))
  )
  /** Persisted layout is applied only after hydration, so the first client render matches the server. */
  const floating = _hasHydrated && storedFloating
  const collapsed = _hasHydrated && storedCollapsed && !storedFloating
  const {
    rect: floatingRect,
    dragHandlers,
    resizeHandlers,
  } = useFloatingPanel(floatRect ?? { x: 0, y: 0, width: panelWidth, height: 0 }, setFloatRect)
  const handleDetach = useCallback(
    () => floatPanel(floatRect ?? getDefaultFloatRect(panelWidth)),
    [floatPanel, floatRect, panelWidth]
  )
  const toolbarRef = useRef<{
    focusSearch: () => void
  } | null>(null)

  // State
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAutoLayouting, setIsAutoLayouting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Hooks
  const userPermissions = useUserPermissionsContext()

  const { isImporting, handleFileChange } = useImportWorkflow({ workspaceId })
  const duplicateWorkflowMutation = useDuplicateWorkflowMutation()
  const { data: workflows = {} } = useWorkflowMap(workspaceId)
  const { data: folders = {} } = useFolderMap(workspaceId)
  const activeWorkflowId = useWorkflowRegistry((state) => state.activeWorkflowId)
  const { handleAutoLayout: autoLayoutWithFitView } = useAutoLayout(activeWorkflowId || null)

  // Check for locked blocks (disables auto-layout)
  const hasLockedBlocks = useWorkflowStore((state) =>
    Object.values(state.blocks).some((block) => block.locked)
  )

  const allBlocksLocked = useWorkflowStore((state) => {
    const blockList = Object.values(state.blocks)
    return blockList.length > 0 && blockList.every((block) => block.locked)
  })

  const hasBlocks = useWorkflowStore((state) => Object.keys(state.blocks).length > 0)

  const { collaborativeBatchToggleLocked } = useCollaborativeWorkflow()

  // Delete workflow hook
  const { isDeleting, handleDeleteWorkflow } = useDeleteWorkflow({
    workspaceId,
    workflowIds: activeWorkflowId || '',
    isActive: true,
    onSuccess: () => setIsDeleteModalOpen(false),
  })

  const currentWorkflow = activeWorkflowId ? workflows[activeWorkflowId] : null
  const workflowLocked = isWorkflowEffectivelyLocked(currentWorkflow, folders)
  const canMutateWorkflow = userPermissions.canEdit && !workflowLocked
  const { isSnapshotView } = useCurrentWorkflow()

  /**
   * Mark hydration as complete on mount
   * This allows React to take over visibility control from CSS
   */
  useEffect(() => {
    setHasHydrated(true)
  }, [setHasHydrated])

  /**
   * Handles tab click events
   */
  const handleTabClick = (tab: PanelTab) => {
    setActiveTab(tab)
  }

  /**
   * Downloads a file with the given content
   */
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    try {
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      logger.error('Failed to download file:', error)
    }
  }, [])

  /**
   * Handles auto-layout of workflow blocks
   */
  const handleAutoLayout = useCallback(async () => {
    if (!canMutateWorkflow || isAutoLayouting) {
      return
    }

    setIsAutoLayouting(true)
    try {
      const result = await autoLayoutWithFitView()
      if (!result.success && result.error) {
        toast({ message: result.error })
      }
    } finally {
      setIsAutoLayouting(false)
    }
  }, [canMutateWorkflow, isAutoLayouting, autoLayoutWithFitView])

  /**
   * Handles exporting workflow as JSON
   */
  const handleExportJson = useCallback(async () => {
    if (!currentWorkflow || !activeWorkflowId) {
      logger.warn('No active workflow to export')
      return
    }

    setIsExporting(true)
    try {
      const workflow = getWorkflowWithValues(activeWorkflowId, workspaceId)

      if (!workflow || !workflow.state) {
        throw new Error('No workflow state found')
      }

      const workflowVariables = useVariablesStore
        .getState()
        .getVariablesByWorkflowId(activeWorkflowId)

      const jsonContent = generateWorkflowJson(workflow.state, {
        workflowId: activeWorkflowId,
        name: currentWorkflow.name,
        description: currentWorkflow.description,
        variables: workflowVariables.map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          value: v.value,
        })),
      })

      const filename = `${currentWorkflow.name.replace(/[^a-z0-9]/gi, '-')}.json`
      downloadFile(jsonContent, filename, 'application/json')
      logger.info('Workflow exported as JSON')
    } catch (error) {
      logger.error('Failed to export workflow as JSON:', error)
    } finally {
      setIsExporting(false)
      setIsMenuOpen(false)
    }
  }, [currentWorkflow, activeWorkflowId, downloadFile])

  /**
   * Handles duplicating the current workflow
   */
  const handleDuplicateWorkflow = useCallback(async () => {
    if (!activeWorkflowId || !userPermissions.canEdit || isDuplicating) {
      return
    }

    const sourceWorkflow = workflows[activeWorkflowId]
    if (!sourceWorkflow) return

    setIsDuplicating(true)
    try {
      const result = await duplicateWorkflowMutation.mutateAsync({
        workspaceId,
        sourceId: activeWorkflowId,
        name: `${sourceWorkflow.name} (Copy)`,
        description: sourceWorkflow.description,
        folderId: sourceWorkflow.folderId,
      })
      if (result?.id) {
        router.push(`/workspace/${workspaceId}/w/${result.id}`)
      }
    } catch (error) {
      logger.error('Error duplicating workflow:', error)
    } finally {
      setIsDuplicating(false)
      setIsMenuOpen(false)
    }
  }, [activeWorkflowId, userPermissions.canEdit, isDuplicating, workflows, router, workspaceId])

  /**
   * Toggles the locked state of all blocks in the workflow
   */
  const handleToggleWorkflowLock = useCallback(() => {
    const blocks = useWorkflowStore.getState().blocks
    const allLocked = Object.values(blocks).every((b) => b.locked)
    const ids = getWorkflowLockToggleIds(blocks, !allLocked)
    if (ids.length > 0) collaborativeBatchToggleLocked(ids)
    setIsMenuOpen(false)
  }, [collaborativeBatchToggleLocked])

  /**
   * Register global keyboard shortcuts using the central commands registry.
   *
   * - Mod+F: Focus Toolbar tab and search input
   */
  useRegisterGlobalCommands(() =>
    createCommands([
      {
        id: 'focus-toolbar-search',
        handler: () => {
          setActiveTab('toolbar')
          toolbarRef.current?.focusSearch()
        },
        overrides: {
          allowInEditable: false,
        },
      },
    ])
  )

  return (
    <>
      <aside
        ref={panelRef}
        className={cn(
          'overflow-hidden bg-[var(--bg)]',
          floating
            ? 'fixed z-30 rounded-lg border border-[var(--border)] shadow-[var(--shadow-overlay)]'
            : 'panel-container relative shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none'
        )}
        style={
          floating
            ? {
                left: floatingRect.x,
                top: floatingRect.y,
                width: floatingRect.width,
                height: floatingRect.height,
              }
            : undefined
        }
        inert={collapsed || undefined}
        aria-label='Workflow panel'
      >
        {/* Docked, the content keeps the panel's full width while the aside animates open or
            closed, so it slides and clips rather than reflowing every frame. */}
        <div
          className={cn(
            'flex h-full flex-col border-[var(--border)] pt-3.5',
            !floating && 'shrink-0 border-l'
          )}
          style={floating ? undefined : { width: panelWidth }}
        >
          {/* Header */}
          <div
            className={cn(
              'flex shrink-0 items-center justify-between px-2',
              floating && 'cursor-grab touch-none active:cursor-grabbing'
            )}
            {...(floating ? dragHandlers : undefined)}
          >
            {/* More and Chat */}
            <div className='flex gap-1.5'>
              <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button className='size-[30px] rounded-[5px]'>
                    <MoreHorizontal className='size-[14px]' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start' side='bottom' sideOffset={8}>
                  <DropdownMenuItem
                    onSelect={handleAutoLayout}
                    disabled={!canMutateWorkflow || isAutoLayouting || hasLockedBlocks}
                    title={hasLockedBlocks ? 'Unlock blocks to use auto-layout' : undefined}
                  >
                    <Layout animate={isAutoLayouting} variant='clockwise' />
                    Auto layout
                  </DropdownMenuItem>
                  {userPermissions.canAdmin && !isSnapshotView && (
                    <DropdownMenuItem
                      onSelect={handleToggleWorkflowLock}
                      disabled={!hasBlocks || workflowLocked}
                      title={
                        workflowLocked
                          ? 'Workflow is locked at the row or folder level — release it from the workflow notification or folder menu'
                          : undefined
                      }
                    >
                      {allBlocksLocked ? <Unlock /> : <Lock />}
                      {allBlocksLocked ? 'Unlock workflow' : 'Lock workflow'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onSelect={handleExportJson}
                    disabled={!userPermissions.canEdit || isExporting || !currentWorkflow}
                  >
                    <Download />
                    Export workflow
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {floating ? (
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <Button
                      className='size-[30px] rounded-[5px]'
                      onClick={dockPanel}
                      aria-label='Dock panel'
                    >
                      <PanelRight className='size-[14px]' />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content side='bottom'>
                    <p>Dock panel to the side</p>
                  </Tooltip.Content>
                </Tooltip.Root>
              ) : (
                <>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <Button
                        className='size-[30px] rounded-[5px]'
                        onClick={handleDetach}
                        aria-label='Detach panel'
                      >
                        <ArrowUpRight className='size-[14px]' />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content side='bottom'>
                      <p>Detach panel into a floating window</p>
                    </Tooltip.Content>
                  </Tooltip.Root>
                </>
              )}
            </div>

            <ItsmSave
              workflowId={activeWorkflowId ?? null}
              disabled={!userPermissions.canEdit || isSnapshotView}
            />
          </div>

          {/* Tabs */}
          <div className='flex shrink-0 items-center justify-between px-2 pt-3.5'>
            <div className='flex gap-1'>
              <Button
                className={`h-[28px] rounded-md border px-2 py-[5px] text-[12.5px] ${
                  _hasHydrated && activeTab === 'toolbar'
                    ? 'border-[var(--border-1)]'
                    : 'border-transparent hover-hover:border-[var(--border-1)] hover-hover:bg-[var(--surface-5)] hover-hover:text-[var(--text-primary)]'
                }`}
                variant={_hasHydrated && activeTab === 'toolbar' ? 'active' : 'ghost'}
                onClick={() => handleTabClick('toolbar')}
                data-tab-button='toolbar'
              >
                Toolbar
              </Button>
              <Button
                className={`h-[28px] rounded-md border px-2 py-[5px] text-[12.5px] ${
                  _hasHydrated && activeTab === 'editor'
                    ? 'border-[var(--border-1)]'
                    : 'border-transparent hover-hover:border-[var(--border-1)] hover-hover:bg-[var(--surface-5)] hover-hover:text-[var(--text-primary)]'
                }`}
                variant={_hasHydrated && activeTab === 'editor' ? 'active' : 'ghost'}
                onClick={() => handleTabClick('editor')}
                data-tab-button='editor'
              >
                Editor
              </Button>
            </div>
          </div>

          {/* Tab Content - Keep all tabs mounted but hidden to preserve state */}
          <div className='flex-1 overflow-hidden pt-3'>
            <div
              className={
                _hasHydrated && activeTab === 'editor'
                  ? 'h-full'
                  : _hasHydrated
                    ? 'hidden'
                    : 'h-full'
              }
              data-tab-content='editor'
            >
              <Editor />
            </div>
            <div
              className={
                _hasHydrated && activeTab === 'toolbar'
                  ? 'h-full'
                  : _hasHydrated
                    ? 'hidden'
                    : 'h-full'
              }
              data-tab-content='toolbar'
            >
              <Toolbar ref={toolbarRef} isActive={activeTab === 'toolbar'} />
            </div>
          </div>
        </div>
        {floating && (
          <div
            aria-hidden
            className='absolute right-0 bottom-0 z-10 size-4 cursor-se-resize touch-none'
            {...resizeHandlers}
          />
        )}
      </aside>

      {/* Rides the panel's left edge: `--panel-width` is 0 while collapsed, so the strip
          follows the panel out to the window edge and back. */}
      {_hasHydrated && !floating && (
        <button
          type='button'
          onClick={toggleCollapsed}
          aria-label={`${collapsed ? 'Open' : 'Close'} ${PANEL_TAB_LABELS[activeTab]}`}
          aria-expanded={!collapsed}
          className='fixed top-[56px] right-[var(--panel-width)] z-30 flex w-7 cursor-pointer flex-col items-center gap-2 rounded-l-lg border border-[var(--border)] border-r-0 bg-[var(--bg)] py-3 transition-[right,background-color] duration-200 ease-out hover-hover:bg-[var(--surface-active)] motion-reduce:transition-none'
        >
          {collapsed ? (
            <ArrowLeft className='size-[14px] text-[var(--text-icon)]' />
          ) : (
            <ArrowRight className='size-[14px] text-[var(--text-icon)]' />
          )}
          <span className='rotate-180 text-[var(--text-body)] text-small [writing-mode:vertical-rl]'>
            {PANEL_TAB_LABELS[activeTab]}
          </span>
        </button>
      )}

      {/* Delete Confirmation Modal */}
      <ChipConfirmModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        srTitle='Delete Workflow'
        title='Delete Workflow'
        defaultAction='dismiss'
        text={[
          'Are you sure you want to delete ',
          { text: currentWorkflow?.name ?? 'this workflow', bold: true },
          '? ',
          {
            text: 'All associated blocks, executions, and configuration will be removed.',
            error: true,
          },
          '',
        ]}
        confirm={{
          label: 'Delete',
          onClick: handleDeleteWorkflow,
          pending: isDeleting,
          pendingLabel: 'Deleting...',
        }}
      />

      {/* Floating Variables Modal */}
      <Variables readOnly={workflowLocked} />
    </>
  )
})
