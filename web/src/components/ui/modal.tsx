"use client";

/**
 * A titled modal with a body and an action row — the shape this app uses for
 * every confirm-and-give-a-reason step. Built on shadcn's Dialog, so the focus
 * trap, Escape, the backdrop and the close button come from Radix.
 */
import { cn } from "@/lib/utils";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const w = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={cn("gap-0 p-0", w, className)}>
        <DialogHeader className="border-b px-5 py-3.5 text-left">
          <DialogTitle className="text-[15px] leading-snug">{title}</DialogTitle>
          {description ? <DialogDescription className="text-[12.5px]">{description}</DialogDescription> : null}
        </DialogHeader>
        {children ? <div className="pane max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? <DialogFooter className="border-t bg-muted/40 px-5 py-3 sm:justify-end">{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
