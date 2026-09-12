import type { HTMLAttributes, TableHTMLAttributes } from "react";

export function Table({ className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${className}`} {...props} />
    </div>
  );
}

export function Th({ className = "", ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`border-b border-line bg-page px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted ${className}`}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={`border-b border-line px-3 py-2 align-top ${className}`} {...props} />;
}
