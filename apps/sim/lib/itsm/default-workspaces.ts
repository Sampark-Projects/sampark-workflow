import type { DbOrTx } from '@/lib/db/types'
import { buildDefaultWorkflowArtifacts } from '@/lib/workflows/defaults'
import { createWorkflowInTransaction } from '@/lib/workflows/orchestration/workflow-lifecycle'
import { saveWorkflowToNormalizedTables } from '@/lib/workflows/persistence/utils'
import { createWorkspaceInTransaction } from '@/lib/workspaces/create'
import { WORKSPACE_MODE } from '@/lib/workspaces/policy'

/** Workspaces every newly provisioned ITSM organization starts with, in creation order. */
export const ITSM_DEFAULT_WORKSPACES = [
  {
    name: 'ITSM',
    workflowNames: ['Incident', 'Change Request', 'Service Request'],
  },
  {
    name: 'ITAM',
    workflowNames: null,
  },
] as const

export interface SeededItsmWorkspace {
  workspaceId: string
  workflowIds: string[]
}

/**
 * Creates the default ITSM and ITAM workspaces for a freshly provisioned organization.
 *
 * ITSM holds one starter rule per ticket type, each seeded with the standard Start → Process
 * graph. ITAM keeps the starter workflow every new workspace gets. Runs inside the
 * provisioning transaction so an organization never exists without its workspaces.
 */
export async function seedItsmDefaultWorkspacesInTransaction(
  tx: DbOrTx,
  params: { organizationId: string; ownerUserId: string }
): Promise<SeededItsmWorkspace[]> {
  const { organizationId, ownerUserId } = params
  const seeded: SeededItsmWorkspace[] = []

  for (const definition of ITSM_DEFAULT_WORKSPACES) {
    const workspace = await createWorkspaceInTransaction(tx, {
      userId: ownerUserId,
      observedOrganizationId: organizationId,
      organizationId,
      name: definition.name,
      skipDefaultWorkflow: definition.workflowNames !== null,
      workspaceMode: WORKSPACE_MODE.ORGANIZATION,
      billedAccountUserId: ownerUserId,
      governingPermissionGroupOrganizationId: null,
    })

    const workflowIds: string[] = []
    for (const workflowName of definition.workflowNames ?? []) {
      const created = await createWorkflowInTransaction(tx, {
        userId: ownerUserId,
        workspaceId: workspace.id,
        name: workflowName,
      })
      await saveWorkflowToNormalizedTables(
        created.id,
        buildDefaultWorkflowArtifacts().workflowState,
        {
          /** Actorless: the starter graph is the platform's, not a member's choice of blocks. */
          workspaceId: null,
          subjectUserId: null,
        },
        tx
      )
      workflowIds.push(created.id)
    }

    seeded.push({ workspaceId: workspace.id, workflowIds })
  }

  return seeded
}
