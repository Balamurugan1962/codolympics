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
          // 14px mark, 24px target: the icon stays quiet, the hit area meets
          // the minimum. Negative margin keeps it from spacing the title out.
          className={cn(
            "-m-[5px] inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-faint transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            className,
          )}
        >
          <Icon.Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-[12px] leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}
