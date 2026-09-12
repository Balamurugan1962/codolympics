import type { HTMLAttributes, ReactNode } from "react";

/** The HackerRank box: white, 1px border, square-ish corners. */
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-box border border-line bg-card ${className}`} {...props} />;
}

export function CardHeader({
  title,
  action,
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between border-b border-line px-4 py-3 ${className}`}>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className}`} {...props} />;
}
