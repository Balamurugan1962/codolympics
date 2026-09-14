/**
 * Page scaffolding shared by every screen.
 *
 * A page is one surface. Regions are separated by a hairline and named by a
 * small label — not by white cards floating on grey, which is how every
 * administration tool built from a template looks and which turns a dense
 * screen into a bag of boxes.
 *
 * `Section` therefore draws a rule and a label, and nothing else. Pass
 * `boxed` for the rare region that genuinely is a discrete object.
 *
 * Anything a page needs to lay itself out comes from here, so spacing stays
 * identical across 27 screens.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
  return <div className={cn("mx-auto w-full px-4 py-5 sm:px-6 lg:px-8", widths[width], className)}>{children}</div>;
}

/** Title, one line of context, and the primary action. Nothing else belongs here. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4", className)}>
      {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {/* A tool, not a publication: the title says which screen this is and
              gets out of the way. Most pages need no description at all — if
              the screen needs a paragraph to explain it, fix the screen. */}
          <h1 className="text-[15px] leading-tight font-semibold tracking-[-0.008em]">{title}</h1>
          {description && <p className="mt-0.5 max-w-[70ch] text-[12px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A named region: a label, a rule, and the content under it.
 *
 * `title` should be nameable in three words — anything longer is two regions.
 * `boxed` puts it back in a bordered panel, for the few places where the
 * content really is a separate object rather than the next part of the page.
 */
export function Section({
  title,
  description,
  actions,
  footer,
  padded = true,
  boxed = false,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  boxed?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  if (boxed) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        {(title || actions) && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
            {actions && <CardAction>{actions}</CardAction>}
          </CardHeader>
        )}
        {padded ? <CardContent className={bodyClassName}>{children}</CardContent> : <div className={bodyClassName}>{children}</div>}
        {footer && <CardFooter className="justify-end">{footer}</CardFooter>}
      </Card>
    );
  }
  return (
    <section className={cn("min-w-0", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-1.5">
          {title && <h2 className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">{title}</h2>}
          {description && <p className="min-w-0 text-[12px] text-muted-foreground">{description}</p>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && (title || actions) ? "pt-3" : undefined, bodyClassName)}>{children}</div>
      {footer && <div className="mt-3 flex justify-end gap-2 border-t pt-3">{footer}</div>}
    </section>
  );
}

/** Filters on the left, actions on the right, sitting above a table. */
export function Toolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 pb-3", className)}>
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A vertical stack with the page's standard gaps. */
export function Stack({ gap = "md", className, children }: { gap?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  const g = { sm: "gap-3", md: "gap-6", lg: "gap-8" }[gap];
  return <div className={cn("flex flex-col", g, className)}>{children}</div>;
}
