/**
 * Handler Registry
 *
 * Sim is only the ITSM rule designer: workflows are authored here and executed by ITSM, so no block
 * handlers are registered. The registry stays so the executor module keeps its shape.
 */

import type { BlockHandler } from '@/executor/types'

/**
 * Create all block handlers.
 *
 * Empty while workflow execution is disabled.
 */
export function createBlockHandlers(): BlockHandler[] {
  return []
}
