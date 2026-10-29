import type { ReactNode } from 'react'

interface WorkspaceTopBarProps {
  /** The workspace switcher, pinned to the start of the bar. */
  workspaceSwitcher: ReactNode
  /** The bar's navigation: the Workflows dropdown, or the settings tabs. */
  navigation: ReactNode
  /** Names what `navigation` selects (e.g. "Workflow"); omitted when it is not a selector. */
  navigationLabel?: string
  /** Trailing, non-interactive status such as the release version. */
  trailing?: ReactNode
}

/** Small caption that names the control beside it, so the selected value reads as a field. */
function BarLabel({ children }: { children: ReactNode }) {
  return <span className='shrink-0 text-[var(--text-muted)] text-caption'>{children}</span>
}

/**
 * The workspace sidebar docked across the top of the window.
 *
 * The workspace switcher and the navigation sit together as labelled fields rather
 * than at opposite ends, so the selected workspace and workflow read at a glance.
 */
export function WorkspaceTopBar({
  workspaceSwitcher,
  navigation,
  navigationLabel,
  trailing,
}: WorkspaceTopBarProps) {
  return (
    <header
      aria-label='Workspace top bar'
      className='flex h-[48px] w-full shrink-0 items-center gap-3 border-[var(--border)] border-b bg-[var(--surface-1)] px-2'
    >
      <div className='flex max-w-[260px] shrink-0 items-center gap-1.5'>
        <BarLabel>Workspace</BarLabel>
        {workspaceSwitcher}
      </div>
      <div className='h-4 w-px shrink-0 bg-[var(--border)]' aria-hidden />
      <div className='flex min-w-0 flex-1 items-center gap-1.5'>
        {navigationLabel ? <BarLabel>{navigationLabel}</BarLabel> : null}
        {navigation}
      </div>
      {trailing ? <div className='flex shrink-0 items-center gap-2 pl-2'>{trailing}</div> : null}
    </header>
  )
}
