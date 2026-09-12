import type { HTMLAttributes, ReactNode } from "react";

/** The box: white, 1px border, square-ish corners. `interactive` adds a hover lift for clickable cards. */
export function Card({ className = "", interactive = false, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={`rounded-box border border-line bg-card ${interactive ? "transition-[border-color,box-shadow] hover:border-line-2 hover:shadow-sm" : ""} ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ title, description, action, className = "" }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 border-b border-line px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold leading-snug">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className}`} {...props} />;
}

export function CardFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex items-center justify-end gap-2 border-t border-line bg-page/60 px-4 py-3 ${className}`} {...props} />;
}
