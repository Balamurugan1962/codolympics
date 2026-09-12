type Tone = "green" | "red" | "amber" | "blue" | "grey" | "navy";

const tones: Record<Tone, string> = {
  green: "bg-green-tint text-green-dark",
  red: "bg-red-tint text-red",
  amber: "bg-amber-tint text-[#9a6b00]",
  blue: "bg-blue-tint text-blue",
  grey: "bg-page text-muted border border-line",
  navy: "bg-navy text-white",
};

export function Badge({ tone = "grey", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-box px-2 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Verdict colours match what a contestant expects: green AC, red everything else, grey IE. */
export function VerdictBadge({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return <Badge tone="grey">Pending</Badge>;
  if (verdict === "AC") return <Badge tone="green">Accepted</Badge>;
  if (verdict === "IE") return <Badge tone="grey">Judge error</Badge>;
  if (verdict === "CE") return <Badge tone="amber">Compile error</Badge>;
  return <Badge tone="red">{verdict}</Badge>;
}
