import { OrderPanel } from "@/components/admin/phase1-order";
import { BackLink, PageBody, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Section A order" };

export default function PuzzleOrderPage() {
  return (
    <PageBody>
      <BackLink href="/admin/phase1/puzzles">Section A · Puzzles</BackLink>
      <PageHeader
        title="Section A order"
        description="The order competitors meet the puzzles in. Drag, or use the arrow keys."
        info="Participants can still answer in any order — this is the order the questions are listed in, and the order the rail counts through."
      />
      <OrderPanel section="puzzles" />
    </PageBody>
  );
}
