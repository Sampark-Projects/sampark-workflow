import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isChatEnabled } from '@/lib/core/config/env-flags'
import { PANEL_WIDTH } from '@/stores/constants'
import type { PanelState, PanelTab } from '@/stores/panel/types'

/**
 * Default panel tab. Falls back to the toolbar when Chat is disabled, since the
 * copilot tab is not rendered then and would leave the panel body empty.
 */
const DEFAULT_TAB: PanelTab = isChatEnabled ? 'copilot' : 'toolbar'

/**
 * Publishes the width the panel occupies in the layout as `--panel-width`. A collapsed or
 * floating panel takes no room, so the variable reads `0px` and everything that measures
 * from it (the canvas boundary, floats, the search palette) reclaims the space.
 */
function applyPanelWidth(width: number, occupiesLayout: boolean) {
  if (typeof window === 'undefined') return
  document.documentElement.style.setProperty('--panel-width', `${occupiesLayout ? width : 0}px`)
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set, get) => ({
      panelWidth: PANEL_WIDTH.DEFAULT,
      setPanelWidth: (width) => {
        // Only enforce minimum - maximum is enforced dynamically by the resize hook
        const clampedWidth = Math.max(PANEL_WIDTH.MIN, width)
        set({ panelWidth: clampedWidth })
        // Update CSS variable for immediate visual feedback
        const { isCollapsed, isFloating } = get()
        applyPanelWidth(clampedWidth, !isCollapsed && !isFloating)
      },
      isCollapsed: false,
      toggleCollapsed: () => {
        const { isCollapsed, isFloating, panelWidth } = get()
        set({ isCollapsed: !isCollapsed })
        applyPanelWidth(panelWidth, isCollapsed && !isFloating)
      },
      isFloating: false,
      floatRect: null,
      floatPanel: (rect) => {
        set({ isFloating: true, isCollapsed: false, floatRect: rect })
        applyPanelWidth(get().panelWidth, false)
      },
      setFloatRect: (rect) => set({ floatRect: rect }),
      dockPanel: () => {
        set({ isFloating: false, isCollapsed: false })
        applyPanelWidth(get().panelWidth, true)
      },
      activeTab: DEFAULT_TAB,
      setActiveTab: (tab) => {
        set({ activeTab: tab })
        // Remove data attribute once React takes control
        if (typeof document !== 'undefined') {
          document.documentElement.removeAttribute('data-panel-active-tab')
        }
      },
      _hasHydrated: false,
      setHasHydrated: (hasHydrated) => {
        set({ _hasHydrated: hasHydrated })
      },
    }),
    {
      name: 'panel-state',
      /**
       * Persist only the durable panel preferences. `activeTab` MUST be kept:
       * the blocking script in `app/layout.tsx` reads it from this persisted
       * `panel-state` entry to set `data-panel-active-tab` before hydration,
       * preventing a tab flash. The `_hasHydrated` hydration marker is
       * excluded.
       */
      partialize: (state) => ({
        panelWidth: state.panelWidth,
        activeTab: state.activeTab,
        isCollapsed: state.isCollapsed,
        isFloating: state.isFloating,
        floatRect: state.floatRect,
      }),
      /** The panel is fixed-width, so a width persisted from when it was resizable is dropped. */
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<typeof current>),
        panelWidth: current.panelWidth,
      }),
      onRehydrateStorage: () => (state) => {
        // Sync CSS variables with stored state after rehydration
        if (state && typeof window !== 'undefined') {
          applyPanelWidth(state.panelWidth, !state.isCollapsed && !state.isFloating)
          // Remove the data attribute so CSS rules stop interfering
          document.documentElement.removeAttribute('data-panel-active-tab')
        }
      },
    }
  )
)
