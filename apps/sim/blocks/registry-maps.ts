import { GenericWebhookBlock } from '@/blocks/blocks/generic_webhook'
import { ItsmApprovalBlock } from '@/blocks/blocks/itsm_approval'
import { ItsmAssignBlock } from '@/blocks/blocks/itsm_assign'
import { ItsmConditionBlock } from '@/blocks/blocks/itsm_condition'
import { ItsmEscalationBlock } from '@/blocks/blocks/itsm_escalation'
import { ItsmProcessBlock } from '@/blocks/blocks/itsm_process'
import { ItsmStartBlock } from '@/blocks/blocks/itsm_start'
import { NoteBlock } from '@/blocks/blocks/note'
import { StartTriggerBlock } from '@/blocks/blocks/start_trigger'
import { StarterBlock } from '@/blocks/blocks/starter'
import type { BlockConfig, BlockMeta } from '@/blocks/types'

/** All block configs keyed by block type. The execution source of truth. */
export const BLOCK_REGISTRY: Record<string, BlockConfig> = {
  generic_webhook: GenericWebhookBlock,
  itsm_approval: ItsmApprovalBlock,
  itsm_assign: ItsmAssignBlock,
  itsm_condition: ItsmConditionBlock,
  itsm_escalation: ItsmEscalationBlock,
  itsm_process: ItsmProcessBlock,
  itsm_start: ItsmStartBlock,
  note: NoteBlock,
  start_trigger: StartTriggerBlock,
  starter: StarterBlock,
}

/**
 * Block presentation/catalog metas (`{ tags, templates }`) keyed by block
 * type. Sibling to `BLOCK_REGISTRY`; pulled from the same block files so the
 * two stay in lockstep without a separate registry to maintain.
 *
 * `BlockMeta` exists only for catalog-visible integrations — every key here
 * has a corresponding entry in `packages/deployment-config/src/integrations.json`. Blocks
 * absent from the catalog (core blocks like `agent`/`api`, superseded base
 * versions, and hidden tools) carry no meta because the only consumers are
 * integration surfaces: `getTemplatesForBlock` (the two integration detail
 * pages) and `getAllBlockMeta()` → `POPULAR_WORKFLOWS` (landing integrations
 * index). The toolbar and search modal read block *configs*, not metas.
 */
export const BLOCK_META_REGISTRY: Record<string, BlockMeta> = {}
