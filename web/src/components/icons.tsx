/** A small inline icon set. No icon library: the hall has no internet and these are 20 lines each. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, p: P) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const Icon = {
  Check: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M20 6 9 17l-5-5" /></svg>,
  X: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M18 6 6 18M6 6l12 12" /></svg>,
  Clock: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  Coins: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><circle cx="9" cy="9" r="6" /><path d="M14.5 6.5A6 6 0 1 1 6.5 14.5" /></svg>,
  Trophy: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4a2 2 0 0 0 0 4h3M17 6h3a2 2 0 0 1 0 4h-3" /></svg>,
  Code: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16" /></svg>,
  Puzzle: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7Z" /></svg>,
  Bug: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M9 8V6a3 3 0 0 1 6 0v2M8 12h8M3 13h3M18 13h3M5 19l2-2M19 19l-2-2M12 8a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0v-2a5 5 0 0 1 5-5Z" /></svg>,
  Gavel: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M14 4l6 6M4 20l7-7M12 6l6 6M9 9l6 6" /></svg>,
  ChevronLeft: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="m15 6-6 6 6 6" /></svg>,
  ChevronRight: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="m9 6 6 6-6 6" /></svg>,
  ChevronDown: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="m6 9 6 6 6-6" /></svg>,
  Menu: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>,
  More: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></svg>,
  Bell: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3V8ZM10 20a2 2 0 0 0 4 0" /></svg>,
  Alert: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>,
  Info: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>,
  Spinner: ({ size = 16, ...p }: P) => <svg {...base(size, p)} className={`animate-spin ${p.className ?? ""}`}><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>,
  Upload: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>,
  Play: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M6 4l14 8-14 8V4Z" /></svg>,
  Flag: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M5 21V4h12l-2 4 2 4H5" /></svg>,
  Users: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" /></svg>,
  Settings: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>,
  Logout: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  Lightbulb: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" /></svg>,
  List: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
  ArrowRight: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  Refresh: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg>,
  Eye: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>,
  Lock: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  Copy: ({ size = 16, ...p }: P) => <svg {...base(size, p)}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
};
