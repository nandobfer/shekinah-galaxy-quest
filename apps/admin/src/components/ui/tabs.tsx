import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  baseId: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

const useTabsContext = () => {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs component")
  }
  return context
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultValue, value: controlledValue, onValueChange, className, ...props }, ref) => {
    const baseId = React.useId()
    const [internalValue, setInternalValue] = React.useState(defaultValue || "")
    const value = controlledValue ?? internalValue

    const handleValueChange = React.useCallback(
      (newValue: string) => {
        setInternalValue(newValue)
        onValueChange?.(newValue)
      },
      [onValueChange]
    )

    return (
      <TabsContext.Provider value={{ value, baseId, onValueChange: handleValueChange }}>
        <div ref={ref} className={cn("w-full", className)} {...props} />
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onKeyDown, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    onKeyDown={event => {
      onKeyDown?.(event)
      if (event.defaultPrevented) return
      const vertical = event.currentTarget.getAttribute('aria-orientation') === 'vertical'
      const previous = vertical ? 'ArrowUp' : 'ArrowLeft'
      const next = vertical ? 'ArrowDown' : 'ArrowRight'
      if (![previous, next, 'Home', 'End'].includes(event.key)) return
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'))
      const current = tabs.findIndex(tab => tab === document.activeElement)
      if (current < 0 || !tabs.length) return
      event.preventDefault()
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === next ? 1 : -1) + tabs.length) % tabs.length
      tabs[index]?.focus(); tabs[index]?.click()
    }}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value: triggerValue, ...props }, ref) => {
    const { value, baseId, onValueChange } = useTabsContext()
    const isActive = value === triggerValue

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${baseId}-tab-${triggerValue}`}
        aria-controls={`${baseId}-panel-${triggerValue}`}
        tabIndex={isActive ? 0 : -1}
        aria-selected={isActive}
        onClick={() => onValueChange(triggerValue)}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isActive
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          className
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value: contentValue, ...props }, ref) => {
    const { value, baseId } = useTabsContext()
    const isActive = value === contentValue

    if (!isActive) return null

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${baseId}-panel-${contentValue}`}
        aria-labelledby={`${baseId}-tab-${contentValue}`}
        tabIndex={0}
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
