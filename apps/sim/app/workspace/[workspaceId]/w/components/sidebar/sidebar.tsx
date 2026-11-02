'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createLogger } from '@sim/logger'
import { useParams } from 'next/navigation'
import { useSession } from '@/lib/auth/auth-client'
import { LOGO_ACCEPT_ATTRIBUTE } from '@/lib/uploads/client/logo-file'
import { useWorkspaceHostContext } from '@/app/workspace/[workspaceId]/providers/workspace-host-provider'
import { useUserPermissionsContext } from '@/app/workspace/[workspaceId]/providers/workspace-permissions-provider'
import {
  SidebarVersion,
  WorkflowsMenu,
  WorkspaceHeader,
  WorkspaceTopBar,
} from '@/app/workspace/[workspaceId]/w/components/sidebar/components'
import {
  useWorkflowOperations,
  useWorkspaceLogoUpload,
  useWorkspaceManagement,
  useWorkspaceWorkflowsRoom,
} from '@/app/workspace/[workspaceId]/w/components/sidebar/hooks'
import { useFolders } from '@/hooks/queries/folders'
import type { Workspace } from '@/hooks/queries/workspace'
import { usePermissionConfig } from '@/hooks/use-permission-config'
import { useSearchModalStore } from '@/stores/modals/search/store'

const logger = createLogger('Sidebar')

/** Window event that scrolls a workflow row into view inside the workflows menu. */
export const SIDEBAR_SCROLL_EVENT = 'sidebar-scroll-to-item'

/**
 * The workspace switcher and the workflows menu, docked as the top bar of the designer.
 *
 * Sim runs only as the ITSM rule designer inside an iframe, so this is the whole navigation
 * surface: switch workspace, pick a workflow, and see the app version.
 *
 * @returns The top bar and, on hosted deployments, the status notice
 */
export const Sidebar = memo(function Sidebar() {
  const params = useParams()
  const workspaceId = params.workspaceId as string
  const workflowId = params.workflowId as string | undefined

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const logoTargetWorkspaceIdRef = useRef<string>(workspaceId)
  const initialScrollDoneRef = useRef(false)

  const { data: sessionData, isPending: sessionLoading } = useSession()
  const { workspace: routeWorkspace } = useWorkspaceHostContext()
  const { canEdit } = useUserPermissionsContext()

  const { filterBlocks, isToolAllowed } = usePermissionConfig()
  const initializeSearchData = useSearchModalStore((state) => state.initializeData)

  /** Feeds the block list the connection block selector reads when a block is added off a handle. */
  useEffect(() => {
    initializeSearchData(filterBlocks, isToolAllowed)
  }, [initializeSearchData, filterBlocks, isToolAllowed])

  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)

  const {
    workspaces,
    pinnedWorkspaceIds,
    toggleWorkspacePin,
    activeWorkspace,
    isWorkspacesLoading,
    switchWorkspace,
    isLeavingWorkspace,
    updateWorkspace,
    handleLeaveWorkspace,
  } = useWorkspaceManagement({
    workspaceId,
    sessionUserId: sessionData?.user?.id,
  })

  const activeWorkspaceFull = workspaces.find((w) => w.id === workspaceId)

  const {
    fileInputRef: logoFileInputRef,
    handleFileChange: handleLogoFileChange,
    setTargetWorkspaceId: setLogoTargetWorkspaceId,
  } = useWorkspaceLogoUpload({
    workspaceId,
    currentLogoUrl: activeWorkspaceFull?.logoUrl,
    onUpload: (url) => {
      updateWorkspace(logoTargetWorkspaceIdRef.current, { logoUrl: url })
    },
    onError: (error) => {
      logger.error('Workspace logo upload error:', error)
    },
  })

  const { regularWorkflows, workflowsLoading } = useWorkflowOperations({ workspaceId })

  useFolders(workspaceId)
  useWorkspaceWorkflowsRoom(workspaceId)

  const isLoading = workflowsLoading || sessionLoading

  /** Scrolls the requested workflow row into view once the menu has rendered it. */
  useEffect(() => {
    const handleScrollToItem = (e: CustomEvent<{ itemId: string }>) => {
      const { itemId } = e.detail
      if (!itemId) return

      const tryScroll = (retriesLeft: number) => {
        requestAnimationFrame(() => {
          const element = document.querySelector(`[data-item-id="${itemId}"]`)
          const container = scrollContainerRef.current

          if (!element || !container) {
            if (retriesLeft > 0) tryScroll(retriesLeft - 1)
            return
          }

          const { top: elTop, bottom: elBottom } = element.getBoundingClientRect()
          const { top: ctTop, bottom: ctBottom } = container.getBoundingClientRect()

          if (elBottom <= ctTop || elTop >= ctBottom) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
      }

      tryScroll(10)
    }
    window.addEventListener(SIDEBAR_SCROLL_EVENT, handleScrollToItem as EventListener)
    return () =>
      window.removeEventListener(SIDEBAR_SCROLL_EVENT, handleScrollToItem as EventListener)
  }, [])

  useEffect(() => {
    if (!workflowId || workflowsLoading || initialScrollDoneRef.current) return
    initialScrollDoneRef.current = true
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent(SIDEBAR_SCROLL_EVENT, { detail: { itemId: workflowId } })
      )
    })
  }, [workflowId, workflowsLoading])

  const handleWorkspaceSwitch = useCallback(
    (workspace: Workspace) => {
      setIsWorkspaceMenuOpen(false)
      if (workspace.id === workspaceId) return
      void switchWorkspace(workspace)
    },
    [workspaceId, switchWorkspace]
  )

  const handleRenameWorkspace = useCallback(
    async (workspaceIdToRename: string, newName: string) => {
      await updateWorkspace(workspaceIdToRename, { name: newName })
    },
    [updateWorkspace]
  )

  const handleUploadLogo = useCallback(
    (workspaceIdToUpdate: string) => {
      logoTargetWorkspaceIdRef.current = workspaceIdToUpdate
      setLogoTargetWorkspaceId(workspaceIdToUpdate)
      logoFileInputRef.current?.click()
    },
    [logoFileInputRef, setLogoTargetWorkspaceId]
  )

  const handleLeaveWorkspaceWrapper = useCallback(
    async (workspaceIdToLeave: string) => {
      const workspaceToLeave = workspaces.find((w) => w.id === workspaceIdToLeave)
      if (workspaceToLeave) {
        await handleLeaveWorkspace(workspaceToLeave)
      }
    },
    [workspaces, handleLeaveWorkspace]
  )

  return (
    <>
      <input
        ref={logoFileInputRef}
        type='file'
        accept={LOGO_ACCEPT_ATTRIBUTE}
        className='hidden'
        onChange={handleLogoFileChange}
      />
      <WorkspaceTopBar
        workspaceSwitcher={
          <WorkspaceHeader
            activeWorkspace={activeWorkspace ?? routeWorkspace}
            workspaceId={workspaceId}
            workspaces={workspaces}
            pinnedWorkspaceIds={pinnedWorkspaceIds}
            onToggleWorkspacePin={toggleWorkspacePin}
            isWorkspacesLoading={isWorkspacesLoading}
            isWorkspaceMenuOpen={isWorkspaceMenuOpen}
            setIsWorkspaceMenuOpen={setIsWorkspaceMenuOpen}
            onWorkspaceSwitch={handleWorkspaceSwitch}
            onRenameWorkspace={handleRenameWorkspace}
            onUploadLogo={handleUploadLogo}
            onLeaveWorkspace={handleLeaveWorkspaceWrapper}
            isLeavingWorkspace={isLeavingWorkspace}
            sessionUserId={sessionData?.user?.id}
          />
        }
        navigationLabel='Workflow'
        navigation={
          <WorkflowsMenu
            workspaceId={workspaceId}
            workflowId={workflowId}
            regularWorkflows={regularWorkflows}
            isLoading={isLoading}
            canReorder={canEdit}
            scrollContainerRef={scrollContainerRef}
          />
        }
        trailing={<SidebarVersion className='p-0' />}
      />
    </>
  )
})
