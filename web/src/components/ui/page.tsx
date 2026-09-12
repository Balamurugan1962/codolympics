/**
 * Page scaffolding shared by every screen.
 *
 * One rhythm everywhere: a content column with a fixed gutter, a header that
 * states what this page is and offers its primary action, and sections that
 * group related things under a title and a sentence of context.
 */
import type { ReactNode } from "react";

type Width = "narrow" | "default" | "wide" | "full";
const widths: Record<Width, string> = {
  narrow: "max-w-3xl",       // forms, reading
  default: "max-w-6xl",      // most pages
  wide: "max-w-[1440px]",    // dense tables
  full: "max-w-none",
};

/** The content column. Every page body starts with one of these. */
export function PageBody({ width = "default", className = "", children }: { width?: Width; className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full ${widths[width]} px-4 py-6 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** Title, one line of context, and the primary action. Nothing else belongs here. */
export function PageHeader({ title, description, actions, breadcrumb, className = "" }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode; className?: string;
}) {
  return (
    <header className={`mb-6 ${className}`}>
      {breadcrumb && <div className="mb-2 text-[13px] text-muted">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] sm:text-2xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A group of related content. `title` is required — anything that cannot be
 * named in three words probably belongs in two sections.
 */
export function Section({ title, description, actions, footer, padded = true, className = "", children }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; footer?: ReactNode; padded?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-box border border-line bg-card ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold leading-snug">{title}</h2>}
            {description && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-page/60 px-5 py-3">{footer}</div>}
    </section>
  );
}

/** Filters on the left, actions on the right, above a table. */
export function Toolbar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A vertical stack with the standard gap. Keeps page rhythm consistent. */
export function Stack({ gap = 4, className = "", children }: { gap?: 3 | 4 | 5 | 6; className?: string; children: ReactNode }) {
  return <div className={`flex flex-col gap-${gap} ${className}`}>{children}</div>;
}
