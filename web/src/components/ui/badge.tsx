import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "./slot";

import { cn } from "@/lib/utils";

/*
 * Status chips. The colours are the contest's vocabulary and are used the same
 * way everywhere: green means done or correct, red means wrong or stopped,
 * amber needs attention, blue means *pending*, and grey is a plain label.
 *
 * `info` and `review` are the same blue on purpose. One is a machine still
 * working and the other is a person who has yet to decide, and at a glance
 * both mean the same thing to whoever is looking: not finished. They keep
 * separate names so the call sites still say which kind of waiting it is.
 *
 * Violet is not in this list. Violet is the accent, and a status chip is never
 * the accent — otherwise "awaiting grading" looks like something you clicked.
 *
 * Grey is the default on purpose. A chip that classifies rather than reports —
 * a version number, a problem kind — takes `neutral`, because if everything is
 * coloured then nothing is. Reach for a colour only when the chip is telling
 * you the state of something.
 *
 * Square-ish rather than a pill: at 11px a full round reads soft and wastes
 * horizontal space next to the dense tables these sit in.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-[4px] border px-1.5 py-0 text-[11px] font-semibold whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        success: "border-green/20 bg-green-tint text-green-dark",
        destructive: "border-red/20 bg-red-tint text-red",
        warning: "border-amber-bg/30 bg-amber-tint text-amber",
        info: "border-blue/20 bg-blue-tint text-blue",
        review: "border-blue/20 bg-blue-tint text-blue",
        neutral: "border-border bg-muted text-muted-foreground",
        outline: "border-line-2 bg-transparent text-muted-foreground",
        navy: "border-transparent bg-navy text-white",
      },
      size: {
        default: "h-5",
        lg: "h-6 px-2.5 text-[12px]",
      },
    },
    defaultVariants: { variant: "neutral", size: "default" },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/** Quieter than a badge: a coloured dot with a word. For statuses inside dense rows. */
function StatusDot({
  tone,
  children,
  className,
}: {
  tone: "success" | "destructive" | "warning" | "info" | "neutral" | "review";
  children?: React.ReactNode;
  className?: string;
}) {
  const dot = {
    success: "bg-green",
    destructive: "bg-red",
    warning: "bg-amber-bg",
    info: "bg-blue",
    review: "bg-blue",
    neutral: "bg-line-2",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      {children}
    </span>
  );
}

/** The judge's verdict, spelled out. Participants should never have to learn the abbreviations. */
const VERDICTS: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "neutral" }> = {
  AC: { label: "Accepted", variant: "success" },
  WA: { label: "Wrong answer", variant: "destructive" },
  TLE: { label: "Time limit", variant: "destructive" },
  MLE: { label: "Memory limit", variant: "destructive" },
  RE: { label: "Runtime error", variant: "destructive" },
  OLE: { label: "Output limit", variant: "destructive" },
  CE: { label: "Compile error", variant: "warning" },
  IE: { label: "Judge error", variant: "neutral" },
};

/** The same words the badge uses, for anywhere a badge will not fit. */
function verdictLabel(verdict: string | null | undefined): string {
  if (!verdict) return "Pending";
  return VERDICTS[verdict]?.label ?? verdict;
}

function VerdictBadge({ verdict, className }: { verdict: string | null | undefined; className?: string }) {
  if (!verdict) return <Badge variant="neutral" className={className}>Pending</Badge>;
  const v = VERDICTS[verdict];
  return (
    <Badge variant={v?.variant ?? "destructive"} className={className}>
      {v?.label ?? verdict}
    </Badge>
  );
}

export { Badge, badgeVariants, StatusDot, VerdictBadge, verdictLabel };
