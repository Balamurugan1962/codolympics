/** The four tiers, easiest first, as they are stored and as people read them. */
export const DIFFICULTIES = ["very_easy", "easy", "medium", "hard"] as const;

const LABEL: Record<string, string> = { very_easy: "very easy", easy: "easy", medium: "medium", hard: "hard" };

export function difficultyLabel(d: string): string {
  return LABEL[d] ?? d.replace(/_/g, " ");
}

export function difficultyVariant(d: string): "info" | "success" | "warning" | "destructive" {
  if (d === "hard") return "destructive";
  if (d === "medium") return "warning";
  if (d === "very_easy") return "info";
  return "success";
}
