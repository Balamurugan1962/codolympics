/**
 * Page scaffolding shared by every screen.
 *
 * One rhythm everywhere: a centred content column with a fixed gutter, a header
 * that states what this page is and offers its primary action, and sections —
 * shadcn Cards with a titled band — that group related things.
 *
 * Anything a page needs to lay itself out should come from here rather than
 * from ad-hoc divs, so spacing stays identical across 27 screens.
 */
import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";
import { Hint } from "./hint";

import { Button } from "./button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

type Width = "narrow" | "default" | "wide" | "full";
const widths: Record<Width, string> = {
  narrow: "max-w-3xl", // forms and reading
  default: "max-w-6xl", // most pages
  wide: "max-w-[1440px]", // dense tables
  full: "max-w-none",
};

/** The content column. Every page body starts with one of these. */
export function PageBody({
  width = "default",
  className,
  children,
}: {
  width?: Width;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8", widths[width], className)}>{children}</div>;
}

/** Title, one line of context, and the primary action. Nothing else belongs here. */
/**
 * The way back out of a sub-page.
 *
 * A real button, not a line of small text above the title: it is the control
 * you reach for when you are finished here, and the browser's back button is
 * not a thing you can see on the page. Same place on every sub-page, so it is
 * found without looking.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="outline" size="sm" className="mb-4" asChild>
      <Link href={href}>
        <Icon.ChevronLeft size={14} />
        {children}
      </Link>
    </Button>
  );
}

export function PageHeader({
  title,
  description,
  info,
  actions,
  breadcrumb,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** The explanation most people never need: behind the i, not on the page. */
  info?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6", className)}>
      {breadcrumb && <div className="mb-2.5">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[22px] leading-tight font-semibold tracking-[-0.015em] sm:text-2xl">
            {title}
            {info && <Hint>{info}</Hint>}
          </h1>
          {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A group of related content: a titled card with an optional action and footer.
 * `title` should be nameable in three words — anything longer is two sections.
 */
export function Section({
  title,
  description,
  info,
  actions,
  footer,
  padded = true,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** The explanation most people never need: behind the i, not on the page. */
  info?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || actions) && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {title}
            {info && <Hint>{info}</Hint>}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
          {actions && <CardAction>{actions}</CardAction>}
        </CardHeader>
      )}
      {padded ? <CardContent className={bodyClassName}>{children}</CardContent> : <div className={bodyClassName}>{children}</div>}
      {footer && <CardFooter className="justify-end">{footer}</CardFooter>}
    </Card>
  );
}

/** Filters on the left, actions on the right, sitting above a table. */
export function Toolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5", className)}>
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A vertical stack with the page's standard gaps. */
export function Stack({ gap = "md", className, children }: { gap?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  const g = { sm: "gap-3", md: "gap-5", lg: "gap-6" }[gap];
  return <div className={cn("flex flex-col", g, className)}>{children}</div>;
}
