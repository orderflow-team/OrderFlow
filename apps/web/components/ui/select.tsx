"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Select({ ...props }: SelectPrimitive.Root.Props<any>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-10 items-center justify-between gap-2 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-4 text-sm font-semibold text-slate-700 outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-emerald-400/70 data-disabled:opacity-50 data-disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-slate-400 shrink-0">
        <ChevronsUpDownIcon className="w-3.5 h-3.5" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("truncate", className)}
      {...props}
    />
  )
}

function SelectContent({
  className,
  children,
  sideOffset = 6,
  ...props
}: SelectPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Backdrop />
      <SelectPrimitive.Positioner
        className="z-50 outline-none"
        sideOffset={sideOffset}
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-[min(24rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-2xl bg-white/70 backdrop-blur-xl backdrop-saturate-150 p-1.5 text-sm text-slate-700 ring-1 ring-white/50 glass-sheen-sm shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-xl py-2 pl-8 pr-3 outline-none transition-colors data-highlighted:bg-emerald-500/10 data-highlighted:text-emerald-700",
        className
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
