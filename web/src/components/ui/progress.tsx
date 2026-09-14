"use client";

import * as React from "react";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

/**
 * DOM change forced by the swap: Base UI puts a Track between the Root and the
 * Indicator, and sizes the Indicator itself instead of leaving the caller to
 * translate it. The Root's classes stay where they were; the rounding and the
 * overflow clip move down to the Track, because that is the element that now
 * draws the bar.
 */
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { value?: number | null }) {
  return (
    <ProgressPrimitive.Root data-slot="progress" value={value} className={cn("relative w-full", className)} {...props}>
      <ProgressPrimitive.Track className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
        <ProgressPrimitive.Indicator data-slot="progress-indicator" className="h-full bg-primary transition-all" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
