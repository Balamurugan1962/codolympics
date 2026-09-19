import { redirect } from "next/navigation";

/**
 * Ordering used to be one page with two tabs. Each section has its own page
 * now; this keeps old links and bookmarks working.
 */
export default function Phase1OrderPage() {
  redirect("/admin/phase1/puzzles/order");
}
