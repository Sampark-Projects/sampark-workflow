import { type JSX, type MouseEvent, memo, useCallback, useMemo, useRef, useState } from 'react'
import { Button, cn, Input, Label, Tooltip } from '@sim/emcn'
import {
  ArrowLeftRight,
  ArrowUp,
  Check,
  Clipboard,
  SquareArrowUpRight,
  TriangleAlert,
} from '@sim/emcn/icons'
import { isEqual } from 'es-toolkit'
import { useParams } from 'next/navigation'
import {
  Code,
  Dropdown,
  InputFormat,
  ItsmApproverGroupsInput,
  ItsmAssigneeGroupsInput,
  ItsmConditionInput,
  LongInput,
  type SelectorOverrides,
  ShortInput,
  Switch,
  Text,
} from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/components/sub-block/components'
import { useDependsOnGate } from '@/app/workspace/[workspaceId]/w/[workflowId]/components/panel/components/editor/components/sub-block/hooks/use-depends-on-gate'
import type { SubBlockConfig } from '@/blocks/types'
import { useWebhookManagement } from '@/hooks/use-webhook-management'

const SLACK_OVERRIDES: SelectorOverrides = {
  transformContext: (context, deps) => {
    // v1 gates on authMethod (raw bot token vs OAuth); v2 has one merged
    // credential field for actions and customBotCredential for triggers.
    const authMethod = deps.authMethod as string
    const oauthCredential =
      authMethod === 'bot_token'
        ? String(deps.botToken ?? '')
        : String(deps.credential ?? deps.customBotCredential ?? '')
    return { ...context, oauthCredential }
  },
}

const FOLDER_OVERRIDES: SelectorOverrides = {
  getDefaultValue: (subBlock) => {
    const isGmail = subBlock.serviceId === 'gmail'
    const isCopyDest = subBlock.canonicalParamId === 'copyDestinationId'
    return isGmail && !isCopyDest ? 'INBOX' : null
  },
}

/**
 * Interface for wand control handlers exposed by sub-block inputs
 */
export interface WandControlHandlers {
  onWandTrigger: (prompt: string) => void
  isWandActive: boolean
  isWandStreaming: boolean
}

/**
 * Props for the SubBlock component.
 *
 * @remarks
 * SubBlock renders a single configurable input within a workflow block,
 * supporting various input types, preview mode, and conditional requirements.
 */
interface SubBlockProps {
  blockId: string
  config: SubBlockConfig
  isPreview?: boolean
  subBlockValues?: Record<string, any>
  disabled?: boolean
  allowExpandInPreview?: boolean
  canonicalToggle?: {
    mode: 'basic' | 'advanced'
    disabled?: boolean
    onToggle?: () => void
  }
  labelSuffix?: React.ReactNode
  /** Provides sibling values for dependency resolution in non-preview contexts (e.g. tool-input) */
  dependencyContext?: Record<string, unknown>
}

/**
 * Returns whether the field is required for validation.
 *
 * @remarks
 * Evaluates conditional requirements based on current field values.
 * Supports boolean, condition objects, and functions that return conditions.
 *
 * @param config - The sub-block configuration containing requirement rules
 * @param subBlockValues - Current values of all subblocks for condition evaluation
 * @returns `true` if the field is required based on current context
 */
const isFieldRequired = (config: SubBlockConfig, subBlockValues?: Record<string, any>): boolean => {
  if (!config.required) return false
  if (typeof config.required === 'boolean') return config.required

  const evalCond = (
    cond: {
      field: string
      value: string | number | boolean | Array<string | number | boolean>
      not?: boolean
      and?: {
        field: string
        value: string | number | boolean | Array<string | number | boolean> | undefined
        not?: boolean
      }
    },
    values: Record<string, any>
  ): boolean => {
    const fieldValue = values[cond.field]?.value
    const condValue = cond.value

    let match: boolean
    if (Array.isArray(condValue)) {
      match = condValue.includes(fieldValue)
    } else {
      match = fieldValue === condValue
    }

    if (cond.not) match = !match

    if (cond.and) {
      const andFieldValue = values[cond.and.field]?.value
      const andCondValue = cond.and.value
      let andMatch: boolean
      if (Array.isArray(andCondValue)) {
        andMatch = andCondValue.includes(andFieldValue)
      } else {
        andMatch = andFieldValue === andCondValue
      }
      if (cond.and.not) andMatch = !andMatch
      match = match && andMatch
    }

    return match
  }

  const condition = typeof config.required === 'function' ? config.required() : config.required
  return evalCond(condition, subBlockValues || {})
}

/**
 * Retrieves the preview value for a specific sub-block.
 *
 * @remarks
 * Only returns a value when in preview mode and subBlockValues are provided.
 * Returns `null` if the value is not found in the subblock values.
 *
 * @param config - The sub-block configuration
 * @param isPreview - Whether the component is in preview mode
 * @param subBlockValues - Optional record of sub-block values
 * @returns The preview value, `null` if not found, or `undefined` if not in preview
 */
const getPreviewValue = (
  config: SubBlockConfig,
  isPreview: boolean,
  subBlockValues?: Record<string, any>
): unknown => {
  if (!isPreview || !subBlockValues) return undefined
  return subBlockValues[config.id]?.value ?? null
}

/**
 * Renders the label with optional validation and description tooltips.
 *
 * @param config - The sub-block configuration defining the label content
 * @param isValidJson - Whether the JSON content is valid (for code blocks)
 * @param subBlockValues - Current values of all subblocks for evaluating conditional requirements
 * @param wandState - State and handlers for the inline AI generate feature
 * @param canonicalToggle - Metadata and handlers for the basic/advanced mode toggle
 * @param canonicalToggleIsDisabled - Whether the canonical toggle is disabled (includes dependsOn gating)
 * @param copyState - State and handler for the copy-to-clipboard button
 * @param labelSuffix - Additional content rendered after the label text
 * @returns The label JSX element, or `null` for switch types or when no title is defined
 */
const renderLabel = (
  config: SubBlockConfig,
  isValidJson: boolean,
  subBlockValues?: Record<string, any>,
  wandState?: {
    isSearchActive: boolean
    searchQuery: string
    isWandEnabled: boolean
    isPreview: boolean
    isStreaming: boolean
    disabled: boolean
    onSearchClick: () => void
    onSearchBlur: () => void
    onSearchChange: (value: string) => void
    onSearchSubmit: () => void
    onSearchCancel: () => void
    searchInputRef: React.RefObject<HTMLInputElement | null>
  },
  canonicalToggle?: {
    mode: 'basic' | 'advanced'
    disabled?: boolean
    onToggle?: () => void
  },
  canonicalToggleIsDisabled?: boolean,
  copyState?: {
    showCopyButton: boolean
    copied: boolean
    onCopy: () => void
  },
  labelSuffix?: React.ReactNode,
  externalLink?: {
    show: boolean
    onClick: () => void
    tooltip: string
  }
): JSX.Element | null => {
  if (config.type === 'switch') return null
  if (!config.title) return null

  const required = isFieldRequired(config, subBlockValues)
  const showWand = wandState?.isWandEnabled && !wandState.isPreview && !wandState.disabled
  const showCanonicalToggle = !!canonicalToggle && !wandState?.isPreview
  const showCopy = copyState?.showCopyButton && !wandState?.isPreview
  const showExternalLink = externalLink?.show && !wandState?.isPreview
  const canonicalToggleDisabledResolved = canonicalToggleIsDisabled ?? canonicalToggle?.disabled

  return (
    <div className='flex items-center justify-between gap-1.5 pl-0.5'>
      <Label className='flex items-baseline gap-1.5 whitespace-nowrap'>
        {config.title}
        {required && <span className='ml-0.5'>*</span>}
        {labelSuffix}
        {config.type === 'code' &&
          config.language === 'json' &&
          !isValidJson &&
          !wandState?.isStreaming && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className='inline-flex'>
                  <TriangleAlert className='size-3 shrink-0 cursor-pointer text-destructive' />
                </span>
              </Tooltip.Trigger>
              <Tooltip.Content side='top'>
                <p>Invalid JSON</p>
              </Tooltip.Content>
            </Tooltip.Root>
          )}
      </Label>
      <div className='flex min-w-0 flex-1 items-center justify-end gap-1.5'>
        {showCopy && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type='button'
                onClick={copyState.onCopy}
                className='-my-1 flex size-5 items-center justify-center'
                aria-label='Copy value'
              >
                {copyState.copied ? (
                  <Check className='size-3 text-green-500' />
                ) : (
                  <Clipboard className='size-3 text-muted-foreground' />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content side='top'>
              <p>{copyState.copied ? 'Copied!' : 'Copy'}</p>
            </Tooltip.Content>
          </Tooltip.Root>
        )}
        {showWand && (
          <>
            {!wandState.isSearchActive ? (
              <Button
                variant='active'
                className='-my-1 h-5 px-2 py-0 text-xs'
                onClick={wandState.onSearchClick}
              >
                Generate
              </Button>
            ) : (
              <div className='-my-1 flex min-w-[120px] max-w-[280px] flex-1 items-center gap-1'>
                <Input
                  ref={wandState.searchInputRef}
                  value={wandState.isStreaming ? 'Generating...' : wandState.searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    wandState.onSearchChange(e.target.value)
                  }
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    // Only close if clicking outside the input container (not on the submit button)
                    const relatedTarget = e.relatedTarget as HTMLElement | null
                    if (relatedTarget?.closest('button')) return
                    wandState.onSearchBlur()
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (
                      e.key === 'Enter' &&
                      wandState.searchQuery.trim() &&
                      !wandState.isStreaming
                    ) {
                      wandState.onSearchSubmit()
                    } else if (e.key === 'Escape') {
                      wandState.onSearchCancel()
                    }
                  }}
                  disabled={wandState.isStreaming}
                  className={cn(
                    'h-5 min-w-[80px] flex-1 text-xs',
                    wandState.isStreaming && 'text-muted-foreground'
                  )}
                  placeholder='Generate with AI...'
                />
                <Button
                  variant='primary'
                  disabled={!wandState.searchQuery.trim() || wandState.isStreaming}
                  onMouseDown={(e: React.MouseEvent) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    wandState.onSearchSubmit()
                  }}
                  className='size-[20px] shrink-0 p-0'
                >
                  <ArrowUp className='size-[12px]' />
                </Button>
              </div>
            )}
          </>
        )}
        {showExternalLink && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type='button'
                className='flex size-[12px] shrink-0 items-center justify-center bg-transparent p-0'
                onClick={externalLink?.onClick}
                aria-label={externalLink?.tooltip}
              >
                <SquareArrowUpRight className='h-[12px]! w-[12px]! text-[var(--text-secondary)]' />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content side='top'>
              <p>{externalLink?.tooltip}</p>
            </Tooltip.Content>
          </Tooltip.Root>
        )}
        {showCanonicalToggle && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type='button'
                className='flex size-[12px] shrink-0 items-center justify-center bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50'
                onClick={canonicalToggle?.onToggle}
                disabled={canonicalToggleDisabledResolved}
                aria-label={
                  canonicalToggle?.mode === 'advanced'
                    ? 'Switch to selector'
                    : 'Switch to manual ID'
                }
              >
                <ArrowLeftRight
                  className={cn(
                    'h-[12px]! w-[12px]!',
                    canonicalToggle?.mode === 'advanced'
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)]'
                  )}
                />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content side='top'>
              <p>
                {canonicalToggle?.mode === 'advanced'
                  ? 'Switch to selector'
                  : 'Switch to manual ID'}
              </p>
            </Tooltip.Content>
          </Tooltip.Root>
        )}
      </div>
    </div>
  )
}

/**
 * Compares props for memo equality check.
 *
 * @param prevProps - Previous component props
 * @param nextProps - Next component props
 * @returns `true` if props are equal and re-render should be skipped
 */
const arePropsEqual = (prevProps: SubBlockProps, nextProps: SubBlockProps): boolean => {
  const subBlockId = prevProps.config.id
  const prevValue = prevProps.subBlockValues?.[subBlockId]?.value
  const nextValue = nextProps.subBlockValues?.[subBlockId]?.value

  const valueEqual = prevValue === nextValue || isEqual(prevValue, nextValue)

  const configEqual =
    prevProps.config.id === nextProps.config.id && prevProps.config.type === nextProps.config.type

  const canonicalToggleEqual =
    !!prevProps.canonicalToggle === !!nextProps.canonicalToggle &&
    prevProps.canonicalToggle?.mode === nextProps.canonicalToggle?.mode &&
    prevProps.canonicalToggle?.disabled === nextProps.canonicalToggle?.disabled

  return (
    prevProps.blockId === nextProps.blockId &&
    configEqual &&
    prevProps.isPreview === nextProps.isPreview &&
    valueEqual &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.allowExpandInPreview === nextProps.allowExpandInPreview &&
    canonicalToggleEqual &&
    prevProps.labelSuffix === nextProps.labelSuffix &&
    prevProps.dependencyContext === nextProps.dependencyContext
  )
}

/**
 * Renders a single workflow sub-block input based on config.type.
 *
 * @param blockId - The parent block identifier
 * @param config - Configuration defining the input type and properties
 * @param isPreview - Whether to render in preview mode
 * @param subBlockValues - Current values of all subblocks
 * @param disabled - Whether the input is disabled
 * @param allowExpandInPreview - Whether to allow expanding in preview mode
 * @param canonicalToggle - Metadata and handlers for the basic/advanced mode toggle
 * @param labelSuffix - Additional content rendered after the label text
 * @param dependencyContext - Sibling values for dependency resolution in non-preview contexts (e.g. tool-input)
 */
function SubBlockComponent({
  blockId,
  config,
  isPreview = false,
  subBlockValues,
  disabled = false,
  allowExpandInPreview,
  canonicalToggle,
  labelSuffix,
  dependencyContext,
}: SubBlockProps): JSX.Element {
  const params = useParams()
  const workspaceId = params.workspaceId as string

  const [isValidJson, setIsValidJson] = useState(true)
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const wandControlRef = useRef<WandControlHandlers | null>(null)

  const webhookManagement = useWebhookManagement({
    blockId,
    triggerId: undefined,
    isPreview,
    useWebhookUrl: config.useWebhookUrl,
    providerWebhookUrl: config.providerWebhookUrl,
  })

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
    e.stopPropagation()
  }

  const handleValidationChange = (isValid: boolean): void => {
    setIsValidJson(isValid)
  }

  const isWandEnabled = config.wandConfig?.enabled ?? false

  /**
   * Handles copying the webhook URL to clipboard.
   */
  const handleCopy = useCallback(() => {
    const textToCopy = webhookManagement?.webhookUrl
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [webhookManagement?.webhookUrl])

  const tableId =
    config.type === 'table-selector' && subBlockValues
      ? (subBlockValues[config.id]?.value as string | null)
      : null
  const hasSelectedTable = tableId && !tableId.startsWith('<')

  const knowledgeBaseId =
    config.type === 'knowledge-base-selector' && subBlockValues
      ? (subBlockValues[config.id]?.value as string | null)
      : null
  const hasSelectedKnowledgeBase = knowledgeBaseId && !knowledgeBaseId.startsWith('<')

  const handleNavigateToTable = useCallback(() => {
    if (tableId && workspaceId) {
      window.open(`/workspace/${workspaceId}/tables/${tableId}`, '_blank')
    }
  }, [workspaceId, tableId])

  const handleNavigateToKnowledgeBase = useCallback(() => {
    if (knowledgeBaseId && workspaceId) {
      window.open(`/workspace/${workspaceId}/knowledge/${knowledgeBaseId}`, '_blank')
    }
  }, [workspaceId, knowledgeBaseId])

  const externalLink = useMemo(() => {
    if (config.type === 'table-selector' && hasSelectedTable) {
      return {
        show: true,
        onClick: handleNavigateToTable,
        tooltip: 'View table',
      }
    }
    if (config.type === 'knowledge-base-selector' && hasSelectedKnowledgeBase) {
      return {
        show: true,
        onClick: handleNavigateToKnowledgeBase,
        tooltip: 'View knowledge base',
      }
    }
    return undefined
  }, [
    config.type,
    hasSelectedTable,
    handleNavigateToTable,
    hasSelectedKnowledgeBase,
    handleNavigateToKnowledgeBase,
  ])

  /**
   * Handles wand icon click to activate inline prompt mode.
   * Focuses the input after a brief delay to ensure DOM is ready.
   */
  const handleSearchClick = (): void => {
    setIsSearchActive(true)
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
  }

  /**
   * Handles search input blur event.
   * Deactivates the search mode if the query is empty and not currently streaming.
   */
  const handleSearchBlur = (): void => {
    if (!searchQuery.trim() && !wandControlRef.current?.isWandStreaming) {
      setIsSearchActive(false)
    }
  }

  /**
   * Handles search query change.
   *
   * @param value - The new search query value
   */
  const handleSearchChange = (value: string): void => {
    setSearchQuery(value)
  }

  /**
   * Handles search submit to trigger AI generation.
   * Clears the query and deactivates search mode after submission.
   */
  const handleSearchSubmit = (): void => {
    if (searchQuery.trim() && wandControlRef.current) {
      wandControlRef.current.onWandTrigger(searchQuery)
      setSearchQuery('')
      setIsSearchActive(false)
    }
  }

  /**
   * Handles search cancel to exit AI prompt mode.
   * Clears the query and deactivates search mode.
   */
  const handleSearchCancel = (): void => {
    setSearchQuery('')
    setIsSearchActive(false)
  }

  const previewValue = getPreviewValue(config, isPreview, subBlockValues) as
    | string
    | string[]
    | null
    | undefined

  const contextValues = dependencyContext ?? (isPreview ? subBlockValues : undefined)

  const { finalDisabled: gatedDisabled } = useDependsOnGate(blockId, config, {
    disabled,
    isPreview,
    previewContextValues: contextValues,
  })

  const isDisabled = gatedDisabled

  /**
   * Selects and renders the appropriate input component based on config.type.
   *
   * @remarks
   * Maps the config type to the corresponding input component with all
   * necessary props. Falls back to an error message for unknown types.
   *
   * @returns The appropriate input component JSX element
   */
  const renderInput = (): JSX.Element => {
    switch (config.type) {
      case 'short-input':
        return (
          <ShortInput
            blockId={blockId}
            subBlockId={config.id}
            placeholder={config.placeholder}
            password={config.password}
            readOnly={config.readOnly}
            useWebhookUrl={config.useWebhookUrl}
            config={config}
            isPreview={isPreview}
            previewValue={previewValue as string | null | undefined}
            disabled={isDisabled}
            wandControlRef={wandControlRef}
            hideInternalWand={true}
          />
        )

      case 'long-input':
        return (
          <LongInput
            blockId={blockId}
            subBlockId={config.id}
            placeholder={config.placeholder}
            password={config.password}
            rows={config.rows}
            config={config}
            isPreview={isPreview}
            previewValue={previewValue as any}
            disabled={isDisabled}
            wandControlRef={wandControlRef}
            hideInternalWand={true}
          />
        )

      case 'dropdown':
        return (
          <div role='presentation' onMouseDown={handleMouseDown}>
            <Dropdown
              blockId={blockId}
              subBlockId={config.id}
              options={config.options as { label: string; id: string }[]}
              defaultValue={typeof config.value === 'function' ? config.value({}) : config.value}
              placeholder={config.placeholder}
              isPreview={isPreview}
              previewValue={previewValue}
              disabled={isDisabled}
              multiSelect={config.multiSelect}
              selectorKey={config.selectorKey}
              selectorExcludeSelf={config.selectorExcludeSelf}
              dependsOn={config.dependsOn}
              searchable={config.searchable}
              preserveLabelCase={config.preserveLabelCase}
              clearable={config.clearable}
            />
          </div>
        )

      case 'code':
        return (
          <Code
            blockId={blockId}
            subBlockId={config.id}
            placeholder={config.placeholder}
            password={config.password}
            language={config.language}
            generationType={config.generationType}
            value={
              typeof config.value === 'function' ? config.value(subBlockValues || {}) : undefined
            }
            isPreview={isPreview}
            previewValue={previewValue as string | null | undefined}
            disabled={isDisabled}
            readOnly={config.readOnly}
            collapsible={config.collapsible}
            defaultCollapsed={config.defaultCollapsed}
            defaultValue={config.defaultValue}
            showCopyButton={config.showCopyButton}
            onValidationChange={handleValidationChange}
            wandConfig={
              config.wandConfig || {
                enabled: false,
                prompt: '',
                placeholder: '',
              }
            }
            wandControlRef={wandControlRef}
            hideInternalWand={true}
          />
        )

      case 'switch':
        return (
          <Switch
            blockId={blockId}
            subBlockId={config.id}
            title={config.title ?? ''}
            value={typeof config.defaultValue === 'boolean' ? config.defaultValue : undefined}
            isPreview={isPreview}
            previewValue={previewValue as any}
            disabled={isDisabled}
          />
        )

      case 'itsm-approver-groups':
        return (
          <ItsmApproverGroupsInput
            blockId={blockId}
            subBlockId={config.id}
            isPreview={isPreview}
            previewValue={previewValue}
            disabled={isDisabled}
          />
        )

      case 'itsm-assignee-groups':
        return (
          <ItsmAssigneeGroupsInput
            blockId={blockId}
            subBlockId={config.id}
            isPreview={isPreview}
            previewValue={previewValue}
            disabled={isDisabled}
          />
        )

      case 'itsm-condition-input':
        return (
          <ItsmConditionInput
            blockId={blockId}
            subBlockId={config.id}
            isPreview={isPreview}
            previewValue={previewValue}
            disabled={isDisabled}
          />
        )

      case 'input-format':
        return (
          <InputFormat
            blockId={blockId}
            subBlockId={config.id}
            isPreview={isPreview}
            previewValue={previewValue as any}
            disabled={isDisabled}
            config={config}
            showValue={true}
          />
        )

      case 'text':
        return (
          <Text
            blockId={blockId}
            subBlockId={config.id}
            content={
              typeof config.value === 'function'
                ? config.value(subBlockValues || {})
                : (config.defaultValue as string) || ''
            }
          />
        )

      default:
        return <div>Unknown input type: {config.type}</div>
    }
  }

  return (
    <div
      role='presentation'
      onMouseDown={handleMouseDown}
      data-workflow-search-subblock-id={config.id}
      data-workflow-search-canonical-id={config.canonicalParamId ?? config.id}
      className='subblock-content flex flex-col gap-2.5'
    >
      {renderLabel(
        config,
        isValidJson,
        subBlockValues,
        {
          isSearchActive,
          searchQuery,
          isWandEnabled,
          isPreview,
          isStreaming: wandControlRef.current?.isWandStreaming ?? false,
          disabled: isDisabled,
          onSearchClick: handleSearchClick,
          onSearchBlur: handleSearchBlur,
          onSearchChange: handleSearchChange,
          onSearchSubmit: handleSearchSubmit,
          onSearchCancel: handleSearchCancel,
          searchInputRef,
        },
        canonicalToggle,
        Boolean(canonicalToggle?.disabled || disabled || isPreview),
        {
          showCopyButton: Boolean(
            config.showCopyButton && (config.useWebhookUrl || config.providerWebhookUrl)
          ),
          copied,
          onCopy: handleCopy,
        },
        labelSuffix,
        externalLink
      )}
      {renderInput()}
    </div>
  )
}

export const SubBlock = memo(SubBlockComponent, arePropsEqual)
