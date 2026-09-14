import * as React from "react";

import { cn } from "@/lib/utils";

/** 16px on phones so iOS does not zoom on focus, 13px from `md` up where the app is dense. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 py-1 text-base shadow-xs transition-[color,border-color,box-shadow] outline-none md:text-[13px]",
        "selection:bg-primary selection:text-primary-foreground placeholder:text-faint",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "hover:border-line-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
