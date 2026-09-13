import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * A panel: white, one hairline border, no shadow at all.
 *
 * Tuned away from the shadcn defaults on purpose — stock cards are airy
 * (rounded-xl, 24px padding, 24px gaps) and this application is dense. Header
 * and footer carry their own rules so a card reads as one object with bands
 * instead of floating boxes inside a box.
 *
 * Flat is deliberate. A shadow says "this is above the page", and on a screen
 * where twelve panels sit side by side none of them is above anything; the
 * border already separates them and the shadow is just grey fuzz.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col rounded-md border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

/** Title, description and an optional action, divided from the body below. */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 border-b px-5 py-3.5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("text-[14.5px] leading-snug font-semibold", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-[12.5px] leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5 py-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-3", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
