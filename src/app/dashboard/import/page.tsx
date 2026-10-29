import { Page, Head } from "@/components/ui";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { Importer } from "./importer";

export default async function ImportPage() {
  const { business } = await requireBusiness();
  const rows = await db.importBatch.findMany({
    where: { businessId: business.id, kind: "orders" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const batches = rows.map((b) => ({
    id: b.id,
    fileName: b.fileName,
    source: b.source,
    orderCount: b.orderCount,
    lineCount: b.lineCount,
    revenueCents: b.revenueCents,
    firstDate: b.firstDate?.toISOString() ?? null,
    lastDate: b.lastDate?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
  }));
  return (
    <Page>
      <Head
        kicker="Migration"
        title="Import your data"
        sub="Switching from another platform? Bring your menu, customers, active subscriptions and months of order history over in minutes."
      />
      <Importer batches={batches} />
    </Page>
  );
}
