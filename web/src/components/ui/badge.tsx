import type { ReactNode } from "react";

type Tone = "green" | "red" | "amber" | "blue" | "grey" | "navy" | "outline";

const tones: Record<Tone, string> = {
  green: "bg-green-tint text-green-dark ring-1 ring-inset ring-green/20",
  red: "bg-red-tint text-red ring-1 ring-inset ring-red/20",
  amber: "bg-amber-tint text-[#8a6100] ring-1 ring-inset ring-amber/30",
  blue: "bg-blue-tint text-blue ring-1 ring-inset ring-blue/20",
  grey: "bg-page text-muted ring-1 ring-inset ring-line-2",
  navy: "bg-navy text-white",
  outline: "text-muted ring-1 ring-inset ring-line-2",
};

export function Badge({ tone = "grey", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5 ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** A coloured dot with a label — quieter than a badge, for statuses in lists. */
export function StatusDot({ tone, children }: { tone: "green" | "red" | "amber" | "blue" | "grey"; children: ReactNode }) {
  const dot = { green: "bg-green", red: "bg-red", amber: "bg-amber", blue: "bg-blue", grey: "bg-line-2" }[tone];
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{children}</span>;
}

export function VerdictBadge({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return <Badge tone="grey">Pending</Badge>;
  if (verdict === "AC") return <Badge tone="green">Accepted</Badge>;
  if (verdict === "IE") return <Badge tone="grey">Judge error</Badge>;
  if (verdict === "CE") return <Badge tone="amber">Compile error</Badge>;
  return <Badge tone="red">{verdict}</Badge>;
}
