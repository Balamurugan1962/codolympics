/** A number with a label, for the dashboard strip: balance, score, time. */
export function Stat({ label, value, tone = "ink" }: { label: string; value: React.ReactNode; tone?: "ink" | "green" | "red" }) {
  const color = tone === "green" ? "text-green-dark" : tone === "red" ? "text-red" : "text-ink";
  return (
    <div className="rounded-box border border-line bg-card px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
