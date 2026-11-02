import { createLogger } from '@sim/logger'
import type { ProviderConfig, ProviderId } from '@/providers/types'

const logger = createLogger('ProviderRegistry')

/**
 * Sim is only the ITSM rule designer, so no LLM provider is registered for execution.
 */
const providerRegistry: Partial<Record<ProviderId, ProviderConfig>> = {}

export async function getProviderExecutor(
  providerId: ProviderId
): Promise<ProviderConfig | undefined> {
  const provider = providerRegistry[providerId]
  if (!provider) {
    logger.error(`Provider not found: ${providerId}`)
    return undefined
  }
  return provider
}
