type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  info: "border-blue/30 bg-blue-tint text-ink",
  success: "border-green/30 bg-green-tint text-ink",
  warning: "border-amber/40 bg-amber-tint text-ink",
  error: "border-red/30 bg-red-tint text-ink",
};

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-box border px-4 py-3 text-sm ${tones[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {title && <div className="font-semibold">{title}</div>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}
