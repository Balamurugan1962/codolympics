import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { ContestProvider, type ContestState } from "@/components/contest-provider";
import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/toast";
import { engineGet } from "@/lib/engine";
import { requireViewer } from "@/lib/session";

/**
 * Signed-in pages. State loads once on the server from the engine, then stays
 * live by polling it.
 *
 * Staff — administrators and evaluators — get the console with its sidebar,
 * because both author content and both need the boards; the sidebar simply
 * shows an evaluator fewer items. Participants get the linear contest frame,
 * where the job is a flow, not a console.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const initial = await engineGet<ContestState>("/api/state", await headers());
  const Frame = viewer.role === "participant" ? Shell : AdminShell;
  return (
    <ContestProvider initial={initial}>
      <Frame>{children}</Frame>
      <Toaster />
    </ContestProvider>
  );
}
