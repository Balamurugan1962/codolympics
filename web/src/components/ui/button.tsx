import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Icon } from "../icons";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "link";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-green text-white shadow-sm hover:bg-green-dark active:translate-y-px disabled:bg-green/40 disabled:shadow-none",
  secondary: "bg-card text-ink border border-line-2 hover:border-ink/40 hover:bg-page active:translate-y-px disabled:text-faint disabled:hover:border-line-2",
  danger: "bg-red text-white hover:brightness-95 disabled:bg-red/40",
  ghost: "bg-transparent text-muted hover:bg-page hover:text-ink disabled:text-faint",
  link: "bg-transparent text-green-dark underline-offset-2 hover:underline px-0 h-auto",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-4 text-sm", lg: "h-11 px-6 text-[15px]" };

export function Button({
  variant = "primary", size = "md", className = "", loading = false, icon, children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-box font-semibold transition-[background-color,border-color,transform] duration-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed
        ${variants[variant]} ${variant === "link" ? "" : sizes[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Icon.Spinner size={14} /> : icon}
      {children}
    </button>
  );
}
