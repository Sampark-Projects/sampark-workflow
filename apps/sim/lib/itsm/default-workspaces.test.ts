/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateWorkspace, mockCreateWorkflow, mockSaveWorkflow } = vi.hoisted(() => ({
  mockCreateWorkspace: vi.fn(),
  mockCreateWorkflow: vi.fn(),
  mockSaveWorkflow: vi.fn(),
}))

vi.mock('@/lib/workspaces/create', () => ({
  createWorkspaceInTransaction: mockCreateWorkspace,
}))
vi.mock('@/lib/workflows/orchestration/workflow-lifecycle', () => ({
  createWorkflowInTransaction: mockCreateWorkflow,
}))
vi.mock('@/lib/workflows/persistence/utils', () => ({
  saveWorkflowToNormalizedTables: mockSaveWorkflow,
}))
vi.mock('@/lib/workflows/defaults', () => ({
  buildDefaultWorkflowArtifacts: () => ({ workflowState: { blocks: {}, edges: [] } }),
}))
vi.mock('@/lib/workspaces/policy', () => ({
  WORKSPACE_MODE: { ORGANIZATION: 'organization' },
}))

import { seedItsmDefaultWorkspacesInTransaction } from '@/lib/itsm/default-workspaces'

describe('seedItsmDefaultWorkspacesInTransaction', () => {
  const tx = {} as never

  beforeEach(() => {
    vi.clearAllMocks()
    let workspaceCount = 0
    let workflowCount = 0
    mockCreateWorkspace.mockImplementation(async () => ({ id: `ws-${++workspaceCount}` }))
    mockCreateWorkflow.mockImplementation(async () => ({ id: `wf-${++workflowCount}` }))
  })

  it('creates the ITSM workspace with three starter workflows, then the ITAM workspace', async () => {
    const seeded = await seedItsmDefaultWorkspacesInTransaction(tx, {
      organizationId: 'org-1',
      ownerUserId: 'user-1',
    })

    expect(mockCreateWorkspace.mock.calls.map(([, params]) => params.name)).toEqual([
      'ITSM',
      'ITAM',
    ])
    expect(mockCreateWorkspace.mock.calls[0][1]).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-1',
      skipDefaultWorkflow: true,
    })
    expect(mockCreateWorkspace.mock.calls[1][1]).toMatchObject({ skipDefaultWorkflow: false })

    expect(mockCreateWorkflow.mock.calls.map(([, params]) => params.name)).toEqual([
      'Incident',
      'Change Request',
      'Service Request',
    ])
    for (const [, params] of mockCreateWorkflow.mock.calls) {
      expect(params.workspaceId).toBe('ws-1')
    }
    expect(mockSaveWorkflow).toHaveBeenCalledTimes(3)
    expect(seeded).toEqual([
      { workspaceId: 'ws-1', workflowIds: ['wf-1', 'wf-2', 'wf-3'] },
      { workspaceId: 'ws-2', workflowIds: [] },
    ])
  })
})
