import { AttackRules, PowerupList } from "@/components/admin/powerups";
import { PageBody, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Powerups" };

export default function PowerupsPage() {
  return (
    <PageBody width="narrow">
      <PageHeader
        title="Powerups"
        description="What is on sale, what it costs, and where it works. Open one to change it."
        info="The marketplace itself is switched on in Settings. Editing a powerup applies to the next purchase and the next use. A blackout or shield already running keeps the duration it started with."
      />
      <div className="space-y-6">
        <PowerupList />
        <AttackRules />
      </div>
    </PageBody>
  );
}
