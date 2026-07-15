import { Boxes, PackageCheck, TriangleAlert, Flame, TrendingDown, ClipboardCheck, ScanLine } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi, Card, CardTitle } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { buildShoppingList, type PurchaseLine } from "@/lib/purchasing";
import { stockValueCents, toBuyQty, stockStatus } from "@/lib/inventory";
import { ANTHROPIC_ENABLED } from "@/lib/anthropic";
import type { TierKey } from "@/lib/tiers";
import { ReceiveForm } from "./receive-form";
import { CountForm } from "./count-form";
import { InvoiceScanner } from "./invoice-scanner";
import { consumeProductionQueue } from "./actions";

const PRODUCING = ["paid", "in_production"] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

export default async function InventoryPage() {
  const { business } = await requireBusiness();
  const isPro = (business.tier as TierKey) === "pro";

  const ingredients = await db.ingredient.findMany({
    where: { businessId: business.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, stockQty: true, costPerUnitCents: true, defaultTrimBps: true },
  });

  // Production-queue requirement (gross) per ingredient — reuse the purchasing engine.
  const orderItems = await db.orderItem.findMany({
    where: { order: { businessId: business.id, status: { in: [...PRODUCING] } }, mealId: { not: null } },
    select: {
      qty: true,
      meal: { select: { ingredients: { select: { qty: true, unit: true, trimBps: true, ingredient: { select: { id: true } } } } } },
    },
  });
  const lines: PurchaseLine[] = [];
  for (const oi of orderItems) {
    if (!oi.meal) continue;
    for (const mi of oi.meal.ingredients) {
      lines.push({ ingredientId: mi.ingredient.id, name: "", unit: mi.unit, costPerUnitCents: 0, netQty: mi.qty * oi.qty, trimBps: mi.trimBps });
    }
  }
  const need = new Map(buildShoppingList(lines).rows.map((r) => [r.ingredientId, r.grossQty]));

  const rows = ingredients.map((ing) => {
    const neededQty = need.get(ing.id) ?? 0;
    const { status, shortfallQty } = stockStatus(ing.stockQty, neededQty);
    return {
      ...ing,
      neededQty,
      status,
      shortfallQty,
      buyQty: toBuyQty(neededQty, ing.stockQty),
      valueCents: stockValueCents(ing.stockQty, ing.costPerUnitCents),
    };
  });

  const totalStockValue = rows.reduce((s, r) => s + r.valueCents, 0);
  const shortCount = rows.filter((r) => r.status === "short").length;
  const toBuyValue = rows.reduce((s, r) => s + Math.round(r.buyQty * r.costPerUnitCents), 0);

  const receipts = await db.ingredientReceipt.findMany({
    where: { businessId: business.id },
    orderBy: { receivedAt: "desc" },
    take: 8,
  });
  const ingName = new Map(ingredients.map((i) => [i.id, i.name]));

  // Waste variance from recent stock counts (measured loss beyond recipe trim).
  const counts = await db.stockCount.findMany({
    where: { businessId: business.id },
    orderBy: { countedAt: "desc" },
    take: 8,
  });
  const unexplainedLossCents = counts.reduce((s, c) => s + Math.max(0, c.varianceCents), 0);

  const statusStyle: Record<string, { fg: string; bg: string; label: string }> = {
    short: { fg: "var(--clay)", bg: "color-mix(in srgb, var(--clay) 10%, transparent)", label: "Short" },
    ok: { fg: "var(--pine)", bg: "color-mix(in srgb, var(--pine) 10%, transparent)", label: "In stock" },
    surplus: { fg: "#8a6d1f", bg: "#f3e9c9", label: "Surplus" },
  };

  return (
    <Page>
      <Head
        kicker="Kitchen OS"
        title="Inventory & receiving"
        sub="Log deliveries, track stock on hand, and buy only what the production queue actually needs."
        right={
          <form action={consumeProductionQueue}>
            <button type="submit" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>
              <Flame size={15} /> Mark run cooked
            </button>
          </form>
        }
      />

      <div className="grid sm:grid-cols-4 gap-3.5 mb-5">
        <Kpi icon={<Boxes size={16} />} label="Stock on hand (value)" value={formatCents(totalStockValue)} />
        <Kpi icon={<TriangleAlert size={16} />} label="Ingredients short" value={shortCount} />
        <Kpi icon={<PackageCheck size={16} />} label="Still to buy (value)" value={formatCents(toBuyValue)} />
        <Kpi icon={<TrendingDown size={16} />} label="Unexplained loss (recent)" value={formatCents(unexplainedLossCents)} />
      </div>

      {/* Invoice scanning — Pro feature (reads line items with Claude vision) */}
      {isPro ? (
        <Card className="mb-4">
          <CardTitle icon={<ScanLine size={15} />} title="Scan an invoice" note="Pro · reads line items with AI" />
          {ANTHROPIC_ENABLED ? (
            <InvoiceScanner />
          ) : (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              Invoice scanning needs an API key — add <code>ANTHROPIC_API_KEY</code> to enable it.
            </p>
          )}
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-9 h-9 rounded-lg shrink-0" style={{ background: "color-mix(in srgb, var(--pine) 10%, transparent)" }}>
              <ScanLine size={17} style={{ color: "var(--pine)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                Scan invoices automatically
                <span className="text-[10px] px-1.5 py-0.5 rounded ml-1.5 align-middle" style={{ background: "var(--sand)", color: "var(--muted)" }}>Pro</span>
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                Snap a photo of a supplier invoice and we&apos;ll fill in your stock. Upgrade your plan in Settings.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Receiving */}
      <Card className="mb-4">
        <CardTitle icon={<PackageCheck size={15} />} title="Receive a delivery" note="Sets real cost/unit from the invoice" />
        <ReceiveForm ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))} />
      </Card>

      {/* Inventory table */}
      <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="hidden sm:grid grid-cols-[1.4fr_100px_100px_100px_110px_90px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
          <div>Ingredient</div>
          <div className="text-right">On hand</div>
          <div className="text-right">Need</div>
          <div className="text-right">To buy</div>
          <div className="text-right">Stock value</div>
          <div>Status</div>
        </div>
        {rows.map((r) => {
          const st = statusStyle[r.status];
          return (
            <div key={r.id} className="grid sm:grid-cols-[1.4fr_100px_100px_100px_110px_90px] grid-cols-2 gap-3 px-4 py-3 items-center" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{r.name}</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink)" }}>{round2(r.stockQty)} {r.unit}</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--muted)" }}>{r.neededQty ? `${round2(r.neededQty)} ${r.unit}` : "—"}</div>
              <div className="text-[12.5px] text-right font-medium" style={{ color: r.buyQty > 0 ? "var(--clay)" : "var(--muted)" }}>{r.buyQty > 0 ? `${round2(r.buyQty)} ${r.unit}` : "—"}</div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>{formatCents(r.valueCents)}</div>
              <div><span className="text-[11px] px-2 py-0.5 rounded-md font-medium" style={{ background: st.bg, color: st.fg }}>{st.label}</span></div>
            </div>
          );
        })}
      </div>

      {/* Waste variance — measured loss vs the recipe forecast */}
      <Card className="mb-4">
        <CardTitle
          icon={<ClipboardCheck size={15} />}
          title="Stock count & waste variance"
          note="What's really on the shelf vs. what the system expected"
        />
        <p className="text-[12.5px] mb-4" style={{ color: "var(--muted)" }}>
          Count an ingredient and we&apos;ll show the gap — loss beyond your recipe trim %
          (over-trimming, spoilage, shrinkage) — in real dollars.
        </p>
        <CountForm ingredients={rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, stockQty: r.stockQty }))} />

        {counts.length > 0 && (
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="text-[12px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
              Recent counts
            </div>
            <div className="space-y-2">
              {counts.map((c) => {
                const loss = c.varianceCents > 0;
                const gain = c.varianceCents < 0;
                return (
                  <div key={c.id} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: "var(--ink)" }}>{ingName.get(c.ingredientId) ?? "—"}</span>
                    <span className="flex items-center gap-3" style={{ color: "var(--muted)" }}>
                      <span>expected {round2(c.expectedQty)} · counted {round2(c.countedQty)}</span>
                      <span
                        className="font-medium tabular-nums"
                        style={{ color: loss ? "var(--clay)" : gain ? "var(--pine)" : "var(--muted)" }}
                      >
                        {loss ? `−${formatCents(c.varianceCents)} lost` : gain ? `+${formatCents(-c.varianceCents)} saved` : "on target"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Recent receipts */}
      <Card>
        <CardTitle title="Recent deliveries" note={`${receipts.length} shown`} />
        {receipts.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>No deliveries logged yet.</p>
        ) : (
          <div className="space-y-2">
            {receipts.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between text-[13px]">
                <span style={{ color: "var(--ink)" }}>{ingName.get(rec.ingredientId) ?? "—"}</span>
                <span style={{ color: "var(--muted)" }}>
                  {round2(rec.qtyReceived)} {rec.unit} · {formatCents(rec.totalCostCents)} ·{" "}
                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(rec.receivedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
