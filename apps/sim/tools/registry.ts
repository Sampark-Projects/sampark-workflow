import type { ExecutableToolConfig } from '@/tools/types'

/**
 * Sim is only the ITSM rule designer: ITSM executes the rules, so no tool is registered here. The
 * registry stays so the tool utilities keep resolving ids against one map.
 */
export const tools: Record<string, ExecutableToolConfig> = {}
