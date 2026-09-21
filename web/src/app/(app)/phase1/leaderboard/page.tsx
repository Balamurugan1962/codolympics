import { redirect } from "next/navigation";

/** The board has one address now. */
export default function Phase1LeaderboardPage() {
  redirect("/leaderboard");
}
