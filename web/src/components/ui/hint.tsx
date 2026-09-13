"use client";

/**
 * A quiet info icon that says more on hover.
 *
 * For advice: worth having, not worth a banner. A tinted alert that cannot be
 * dismissed and has no action attached becomes furniture on a page you open
 * every day, and then the alerts that *do* stop you get ignored with it.
 * Banners are for blocking facts; this is for everything else.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function Hint({ children, label = "More information", className }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn("inline-flex shrink-0 text-faint transition-colors hover:text-muted-foreground", className)}
        >
          <Icon.Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-[12px] leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}
