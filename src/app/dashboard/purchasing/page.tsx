import { Carrot, DollarSign, TrendingDown, ShoppingCart, AlertTriangle } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head, Kpi } from "@/components/ui";
import { formatCents, bpsToPercent } from "@/lib/money";
import { buildShoppingList, type PurchaseLine } from "@/lib/purchasing";
import { CostCell } from "./cost-cell";

// Demand comes from orders awaiting production (same set as the production report).
const PRODUCING = ["paid", "in_production"] as const;

export default async function PurchasingPage() {
  const { business } = await requireBusiness();

  // Every order line awaiting production, with its meal's recipe + ingredient costs.
  const orderItems = await db.orderItem.findMany({
    where: {
      order: { businessId: business.id, status: { in: [...PRODUCING] } },
      mealId: { not: null },
    },
    select: {
      qty: true,
      meal: {
        select: {
          ingredients: {
            select: {
              qty: true,
              unit: true,
              trimBps: true,
              ingredient: {
                select: { id: true, name: true, unit: true, costPerUnitCents: true },
              },
            },
          },
        },
      },
    },
  });

  // Explode into per-recipe-line purchase needs (net qty = recipe qty × meals).
  const lines: PurchaseLine[] = [];
  for (const oi of orderItems) {
    if (!oi.meal) continue;
    for (const mi of oi.meal.ingredients) {
      lines.push({
        ingredientId: mi.ingredient.id,
        name: mi.ingredient.name,
        unit: mi.unit,
        costPerUnitCents: mi.ingredient.costPerUnitCents,
        netQty: mi.qty * oi.qty,
        trimBps: mi.trimBps,
      });
    }
  }

  const list = buildShoppingList(lines);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return (
    <Page>
      <Head
        kicker="Kitchen OS"
        title="Purchasing & waste"
        sub="What to buy for the production queue — trim-aware, with the dollars you're over-buying."
      />

      <div className="grid sm:grid-cols-3 gap-3.5 mb-5">
        <Kpi
          icon={<ShoppingCart size={16} />}
          label="To purchase"
          value={formatCents(list.totalBuyCents)}
        />
        <Kpi
          icon={<TrendingDown size={16} />}
          label="Over-bought (trim waste)"
          value={formatCents(list.totalWasteCents)}
        />
        <Kpi
          icon={<DollarSign size={16} />}
          label="Waste share"
          value={`${bpsToPercent(list.wasteBps).toFixed(1)}%`}
        />
      </div>

      {list.totalWasteCents > 0 && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg mb-5"
          style={{
            background: "color-mix(in srgb, var(--clay) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--clay) 22%, transparent)",
          }}
        >
          <AlertTriangle size={16} style={{ color: "var(--clay)", marginTop: 1 }} />
          <p className="text-[13px]" style={{ color: "var(--ink)" }}>
            You&apos;re buying <strong>{formatCents(list.totalWasteCents)}</strong> of
            ingredients you&apos;ll trim away this run. The biggest offenders are at the
            top — tighter cuts, portioning, or supplier specs on these cut real dollars.
          </p>
        </div>
      )}

      {list.rows.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <Carrot size={24} className="mx-auto mb-3" style={{ color: "var(--muted)" }} />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            Nothing to purchase.
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--muted)" }}>
            The shopping list builds from orders marked paid or in production.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <div
            className="hidden sm:grid grid-cols-[1.4fr_90px_90px_130px_110px] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--muted)", borderBottom: "1px solid var(--line)" }}
          >
            <div>Ingredient</div>
            <div className="text-right">Need</div>
            <div className="text-right">Buy</div>
            <div>Cost / unit</div>
            <div className="text-right">Over-bought</div>
          </div>

          {list.rows.map((r) => (
            <div
              key={r.ingredientId}
              className="grid sm:grid-cols-[1.4fr_90px_90px_130px_110px] grid-cols-2 gap-3 px-4 py-3 items-center"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {r.name}
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  {bpsToPercent(trimOf(r)).toFixed(1)}% trim · buy cost {formatCents(r.buyCostCents)}
                </div>
              </div>
              <div className="text-[12.5px] text-right" style={{ color: "var(--ink-soft)" }}>
                {round2(r.netQty)} {r.unit}
              </div>
              <div className="text-[12.5px] text-right font-medium" style={{ color: "var(--ink)" }}>
                {round2(r.grossQty)} {r.unit}
              </div>
              <div>
                <CostCell
                  ingredientId={r.ingredientId}
                  costDollars={r.costPerUnitCents / 100}
                  unit={r.unit}
                />
              </div>
              <div
                className="text-[13px] font-semibold text-right"
                style={{ color: r.wasteCostCents > 0 ? "var(--clay)" : "var(--muted)" }}
              >
                {formatCents(r.wasteCostCents)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

// Effective trim implied by the aggregated net/gross (for display only).
function trimOf(r: { netQty: number; grossQty: number }): number {
  if (r.grossQty <= 0) return 0;
  return Math.round((1 - r.netQty / r.grossQty) * 10000);
}
