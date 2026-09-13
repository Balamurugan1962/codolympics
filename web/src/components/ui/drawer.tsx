"use client";

/**
 * A right-hand sheet for detail that would otherwise push a list off screen.
 * Radix supplies the focus trap, the Escape key and the scroll lock.
 */
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
}) {
  const w = { md: "sm:max-w-md", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[width];
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className={`w-full gap-0 ${w}`}>
        <SheetHeader className="border-b px-5 py-3.5">
          <SheetTitle className="text-[15px] leading-snug">{title}</SheetTitle>
          {description ? <SheetDescription className="text-[12px]">{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="pane min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
