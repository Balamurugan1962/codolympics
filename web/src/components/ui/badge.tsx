import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/*
 * Status pills. The colours are the contest's vocabulary and are used the same
 * way everywhere: green means done or correct, red means wrong or stopped,
 * amber means in progress or needs attention, blue means informational,
 * violet marks something a human must still judge.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        success: "border-green/20 bg-green-tint text-green-dark",
        destructive: "border-red/20 bg-red-tint text-red",
        warning: "border-amber-bg/30 bg-amber-tint text-amber",
        info: "border-blue/20 bg-blue-tint text-blue",
        review: "border-violet/20 bg-violet-tint text-violet",
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
  const Comp = asChild ? Slot.Root : "span";
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
    review: "bg-violet",
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

function VerdictBadge({ verdict, className }: { verdict: string | null | undefined; className?: string }) {
  if (!verdict) return <Badge variant="neutral" className={className}>Pending</Badge>;
  const v = VERDICTS[verdict];
  return (
    <Badge variant={v?.variant ?? "destructive"} className={className}>
      {v?.label ?? verdict}
    </Badge>
  );
}

export { Badge, badgeVariants, StatusDot, VerdictBadge };
