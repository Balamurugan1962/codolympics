import { OrderPanel } from "@/components/admin/phase1-order";
import { BackLink, PageBody, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Section B order" };

export default function HackOrderPage() {
  return (
    <PageBody>
      <BackLink href="/admin/phase1/hacking">Section B · Hacking</BackLink>
      <PageHeader
        title="Section B order"
        description="The order competitors meet the flawed solutions in. Drag, or use the arrow keys."
        info="Participants can attempt them in any order. This sets how they are listed."
      />
      <OrderPanel section="hacking" />
    </PageBody>
  );
}
