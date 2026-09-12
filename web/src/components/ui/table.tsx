import type { HTMLAttributes, TableHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * Tables read as rows of facts, not as a grid of boxes: a quiet header, 48px
 * rows, one border between them, numbers right-aligned and tabular.
 */
export function Table({ className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-[13px] ${className}`} {...props} />
    </div>
  );
}

export function Th({ className = "", align = "left", ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-line bg-page/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
      {...props}
    />
  );
}

export function Td({ className = "", align = "left", ...props }: HTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={`border-b border-line px-4 py-3 align-middle ${align === "right" ? "text-right tabular-nums" : align === "center" ? "text-center" : ""} ${className}`}
      {...props}
    />
  );
}

/** Rows get a hover tint and an optional selected state. */
export function Tr({ className = "", selected = false, ...props }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return <tr className={`transition-colors ${selected ? "bg-green-tint" : "hover:bg-page/60"} ${className}`} {...props} />;
}
