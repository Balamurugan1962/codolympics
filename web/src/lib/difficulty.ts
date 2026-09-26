/** The five tiers, easiest first, as they are stored and as people read them. */
export const DIFFICULTIES = ["beginner", "easy", "easy_medium", "medium", "hard"] as const;

const LABEL: Record<string, string> = {
  beginner: "beginner",
  easy: "easy",
  easy_medium: "easy-medium",
  medium: "medium",
  hard: "hard",
};

export function difficultyLabel(d: string): string {
  return LABEL[d] ?? d.replace(/_/g, " ");
}

export function difficultyVariant(d: string): "info" | "success" | "warning" | "destructive" {
  if (d === "hard") return "destructive";
  if (d === "medium" || d === "easy_medium") return "warning";
  if (d === "beginner") return "info";
  return "success";
}
