import { AdminShell } from "@/components/admin/admin-shell";
import { ContestProvider, type ContestState } from "@/components/contest-provider";
import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/toast";
import { requireViewer } from "@/lib/session";
import { stateFor } from "@/lib/state";

/**
 * Signed-in pages. State loads once on the server, then stays live over SSE.
 *
 * Staff — administrators and evaluators — get the console with its sidebar,
 * because both author content and both need the boards; the sidebar simply
 * shows an evaluator fewer items. Participants get the linear contest frame,
 * where the job is a flow, not a console.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const initial = (await stateFor(viewer)) as unknown as ContestState;
  const Frame = viewer.role === "participant" ? Shell : AdminShell;
  return (
    <ContestProvider initial={initial}>
      <Frame>{children}</Frame>
      <Toaster />
    </ContestProvider>
  );
}
