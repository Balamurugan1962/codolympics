"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
})

/**
 * Base UI's ToggleGroup is always array-valued, with `toggleMultiple` deciding
 * whether more than one can be pressed. Radix modelled single-select as a
 * plain string and `type="single"`. Call sites keep the Radix shape and the
 * translation happens here — a segmented control that has to think about
 * arrays is a segmented control nobody wants to write twice.
 */
function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  children,
  type = "single",
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof ToggleGroupPrimitive>, "value" | "onValueChange"> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    type?: "single" | "multiple"
    value?: string | string[]
    onValueChange?: (value: never) => void
  }) {
  const multiple = type === "multiple"
  const groupValue = value === undefined ? undefined : Array.isArray(value) ? value : value === "" ? [] : [value]
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      multiple={multiple}
      value={groupValue}
      onValueChange={(next) => {
        const cb = onValueChange as ((v: string | string[]) => void) | undefined
        cb?.(multiple ? next : ((next[next.length - 1] ?? "") as string))
      }}
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      // The spacing is an inline style rather than the upstream
      // `gap-[--spacing(var(--gap))]`: a Tailwind function nested in an
      // arbitrary value in a class name is a lot of machinery for one
      // multiplication, and this says the same thing in plain CSS.
      style={{ gap: `calc(var(--spacing) * ${spacing})` } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit items-center rounded-md",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
