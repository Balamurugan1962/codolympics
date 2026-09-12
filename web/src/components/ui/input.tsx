import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { Icon } from "../icons";

const base =
  "w-full rounded-box border border-line-2 bg-card text-[13px] text-ink placeholder:text-faint transition-[border-color,box-shadow] " +
  "hover:border-ink/25 focus:border-green focus:outline-none focus:ring-[3px] focus:ring-green/15 " +
  "disabled:cursor-not-allowed disabled:bg-page disabled:text-faint disabled:hover:border-line-2";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`h-9 px-3 ${base} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`px-3 py-2 leading-relaxed ${base} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`h-9 cursor-pointer pl-3 pr-8 ${base} ${className}`} {...props} />;
}

/** A search box with its icon. Used above every table. */
export function SearchInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <Icon.Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
      <input type="search" className={`h-9 pl-8 pr-3 ${base}`} {...props} />
    </div>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-semibold text-ink">{children}</span>
      {hint && <span className="text-[11px] font-normal text-faint">{hint}</span>}
    </label>
  );
}

/** Label, control, and an optional line of help beneath it. */
export function Field({ label, hint, help, error, children, className = "" }: {
  label?: ReactNode; hint?: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label hint={hint}>{label}</Label>}
      {children}
      {error ? <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-red"><Icon.Alert size={12} /> {error}</p>
        : help ? <p className="mt-1 text-[11.5px] leading-relaxed text-faint">{help}</p> : null}
    </div>
  );
}

/** A checkbox with its label, aligned so the text does not shift. */
export function Checkbox({ label, help, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; help?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 ${className}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-green" {...props} />
      <span className="min-w-0">
        <span className="text-[13px] font-medium">{label}</span>
        {help && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-faint">{help}</span>}
      </span>
    </label>
  );
}
