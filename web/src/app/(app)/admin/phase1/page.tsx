import { redirect } from "next/navigation";

/** Phase 1 is three pages now; this keeps old links working. */
export default function Phase1Index() {
  redirect("/admin/phase1/puzzles");
}
