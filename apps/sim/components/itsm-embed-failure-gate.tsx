'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { isEmbedded, reportEmbedFailure } from '@/lib/itsm/embed-failure'

interface EmbedFailureGateProps {
  reason: string
  children: ReactNode
}

/**
 * Renders a failure or sign-in screen only for top-level visits. Inside the
 * ITSM iframe it renders nothing and reports the failure to the parent, which
 * shows its own retry screen instead of Sim branding or a login form.
 */
export function EmbedFailureGate({ reason, children }: EmbedFailureGateProps) {
  const [embedded, setEmbedded] = useState<boolean | null>(null)

  useEffect(() => {
    const inFrame = isEmbedded()
    setEmbedded(inFrame)
    if (inFrame) reportEmbedFailure(reason)
  }, [reason])

  if (embedded !== false) return null
  return children
}
