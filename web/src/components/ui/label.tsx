"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Radix shipped a Label primitive whose only real job was forwarding clicks to
 * its control — which every browser already does for a `<label htmlFor>`. Base
 * UI has no equivalent because there is nothing to wrap, so this is the plain
 * element with our classes on it.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
