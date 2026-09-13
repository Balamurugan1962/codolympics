import { AdminShell } from "@/components/admin/admin-shell";
import { ContestProvider, type ContestState } from "@/components/contest-provider";
import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/toast";
import { requireViewer } from "@/lib/session";
import { stateFor } from "@/lib/state";

/**
 * Signed-in pages. State loads once on the server, then stays live over SSE.
 * Administrators get a console with a sidebar; everyone else gets the linear
 * contest frame.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const initial = (await stateFor(viewer)) as unknown as ContestState;
  const Frame = viewer.role === "admin" ? AdminShell : Shell;
  return (
    <ContestProvider initial={initial}>
      <Frame>{children}</Frame>
      <Toaster />
    </ContestProvider>
  );
}
