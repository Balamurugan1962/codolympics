import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-green text-white hover:bg-green-dark disabled:bg-green/40",
  secondary: "bg-card text-ink border border-line-2 hover:bg-page disabled:text-faint",
  danger: "bg-red text-white hover:brightness-95 disabled:bg-red/40",
  ghost: "bg-transparent text-muted hover:bg-page hover:text-ink disabled:text-faint",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-box font-semibold
        transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
