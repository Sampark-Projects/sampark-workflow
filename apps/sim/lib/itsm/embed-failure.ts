/** `postMessage` type ITSM's workflow editor listens for to show its own retry screen. */
export const ITSM_EMBED_FAILURE_MESSAGE = 'sim:embed-failure'

/** Whether this window is rendered inside another page's iframe (ITSM's Flow Builder). */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Tells the embedding ITSM page that Sim failed to load so it can replace the
 * iframe with its own generic error and retry. The message carries no data
 * beyond a reason code, so any parent origin may receive it.
 *
 * @returns `true` when embedded and the failure was reported.
 */
export function reportEmbedFailure(reason: string): boolean {
  if (!isEmbedded()) return false
  window.parent.postMessage({ type: ITSM_EMBED_FAILURE_MESSAGE, reason }, '*')
  return true
}
