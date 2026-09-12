import { ContestProvider, type ContestState } from "@/components/contest-provider";
import { Shell } from "@/components/shell";
import { requireViewer } from "@/lib/session";
import { stateFor } from "@/lib/state";

/** Every signed-in page: state is loaded server-side once, then kept live over SSE. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const initial = (await stateFor(viewer)) as unknown as ContestState;
  return (
    <ContestProvider initial={initial}>
      <Shell>{children}</Shell>
    </ContestProvider>
  );
}
