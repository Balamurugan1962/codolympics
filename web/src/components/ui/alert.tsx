import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * A banner that explains a state. Tinted rather than outlined, because these
 * appear inside white cards where a plain border would disappear.
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-md border px-4 py-3 text-[13px] has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "border-border bg-muted/60 text-foreground",
        info: "border-brand/20 bg-brand-tint text-brand-deep",
        success: "border-green/20 bg-green-tint text-green-dark",
        warning: "border-amber-bg/30 bg-amber-tint text-amber",
        destructive: "border-red/25 bg-red-tint text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 min-h-4 font-semibold tracking-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 text-[12.5px] leading-relaxed opacity-90 [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
