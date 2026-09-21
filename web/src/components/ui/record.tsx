"use client";

/**
 * The page for one record: a participant, a problem, a question.
 *
 * Every such page answers the same three questions in the same places, so an
 * organiser's eye learns where to look once. Who or what this is, and how it
 * stands: the header, with its few key numbers in one line rather than a row
 * of cards. What happened: the main column. What can be done about it, and
 * the facts that rarely change: the aside, which stays put while the main
 * column scrolls.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function RecordHeader({ back, title, chips, meta, actions, figures, children }: {
  back: { href: string; label: string };
  title: ReactNode;
  /** Status, next to the name: disqualified, live, solved. */
  chips?: ReactNode;
  /** One quiet line under the name. */
  meta?: ReactNode;
  actions?: ReactNode;
  /** The numbers that describe how it stands, as one strip. */
  figures?: Figure[];
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <Link href={back.href} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <Icon.ChevronLeft size={14} /> {back.label}
      </Link>
      <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2.5 text-[24px] leading-tight font-semibold tracking-[-0.015em]">
            {title}
            {chips}
          </h1>
          {meta && <p className="mt-1.5 text-[13px] text-muted-foreground">{meta}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {figures && figures.length > 0 && <Figures items={figures} className="mt-5" />}
      {children}
    </header>
  );
}

export type Figure = { label: string; value: ReactNode; note?: ReactNode; tone?: "default" | "success" | "warning" | "destructive" };

const TONE = {
  default: "",
  success: "text-green-dark",
  warning: "text-amber",
  destructive: "text-destructive",
};

/** The numbers that describe how something stands, as one quiet strip rather than a row of cards. */
export function Figures({ items, className }: { items: Figure[]; className?: string }) {
  return (
    <dl className={cn("flex flex-wrap gap-x-10 gap-y-3 border-y border-line py-3.5", className)}>
      {items.map((f) => (
        <div key={f.label} className="min-w-[7rem]">
          <dt className="text-[12px] text-muted-foreground">{f.label}</dt>
          <dd className="mt-0.5 flex items-baseline gap-2">
            <span className={cn("text-[20px] leading-none font-semibold tabular-nums", TONE[f.tone ?? "default"])}>{f.value}</span>
            {f.note && <span className="text-[12px] text-faint">{f.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A few states to filter a list by, each with how many it holds. */
export function FilterChips<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
            value === o.value ? "border-navy bg-navy text-white" : "border-line bg-card text-muted-foreground hover:border-line-2 hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cn("tabular-nums", value === o.value ? "text-white/70" : "text-faint")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Main column and a sticky aside. The aside comes first on a phone, where it is short. */
export function RecordBody({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="order-2 min-w-0 space-y-5 lg:order-1">{children}</div>
      <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-[72px]">{aside}</aside>
    </div>
  );
}

/** A titled block in the aside. */
export function AsideBlock({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-box border border-line bg-card", className)}>
      <h2 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold">{title}</h2>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** Facts as label and value, one per line. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="space-y-2.5 text-[13px]">
      {items.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">{f.label}</dt>
          <dd className="min-w-0 text-right font-medium break-words">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The actions that belong to the record, one per line, the dangerous one last. */
export function ActionList({ items }: { items: { label: string; icon?: ReactNode; onSelect: () => void; tone?: "default" | "destructive"; disabled?: boolean }[] }) {
  return (
    <ul className="-mx-1 space-y-0.5">
      {items.map((a) => (
        <li key={a.label}>
          <button
            type="button"
            onClick={a.onSelect}
            disabled={a.disabled}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
              a.tone === "destructive" ? "text-destructive hover:bg-red-tint" : "text-foreground",
            )}
          >
            <span className="text-faint [&_svg]:size-[15px]">{a.icon}</span>
            {a.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One row in a dense list that opens in place. The row says what it is and how
 * it went; the detail says why. `lead` is the mark on the left (a tick, a
 * number), `trail` the figure on the right.
 */
export function ExpandableRow({ lead, title, chips, trail, open, onToggle, children }: {
  lead?: ReactNode;
  title: ReactNode;
  chips?: ReactNode;
  trail?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <li className={cn(open && "bg-muted/30")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <span className="w-5 shrink-0">{lead}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13.5px] font-medium">{title}</span>
            {chips}
          </span>
        </span>
        {trail && <span className="shrink-0 text-right tabular-nums">{trail}</span>}
        <Icon.ChevronDown size={14} className={cn("shrink-0 text-faint transition-transform", open ? "" : "-rotate-90")} />
      </button>
      {open && children && <div className="border-t border-line/70 px-4 py-3 pl-12">{children}</div>}
    </li>
  );
}

/** A label and its value inside an opened row. */
export function Detail({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <div className="text-[12.5px] text-muted-foreground">{label}</div>
      <div className={cn("min-w-0 text-[13px] break-words", mono && "font-mono text-[12.5px]")}>{children}</div>
    </div>
  );
}

/** A row in the same list that is a page of its own. */
export function LinkRow({ href, lead, title, chips, trail }: { href: string; lead?: ReactNode; title: ReactNode; chips?: ReactNode; trail?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
        <span className="w-5 shrink-0">{lead}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[13.5px] font-medium">{title}</span>
            {chips}
          </span>
        </span>
        {trail && <span className="shrink-0 text-right tabular-nums">{trail}</span>}
        <Icon.ChevronRight size={14} className="shrink-0 text-faint" />
      </Link>
    </li>
  );
}
