import { redirect } from "next/navigation";

/** Sections are not separate destinations any more — the contest screen is whatever is open. */
export default function Moved() {
  redirect("/dashboard");
}
