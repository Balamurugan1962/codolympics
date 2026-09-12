import { redirect } from "next/navigation";

import { homeFor, optionalViewer } from "@/lib/session";

export default async function Root() {
  const viewer = await optionalViewer();
  redirect(viewer ? homeFor(viewer.role) : "/login");
}
