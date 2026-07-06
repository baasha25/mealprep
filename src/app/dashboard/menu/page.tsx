import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff, UtensilsCrossed, Star } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { toggleMealActive, deleteMeal } from "./actions";

export default async function MenuPage() {
  const { business } = await requireBusiness();
  const meals = await db.meal.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { ingredients: true, reviews: true } } },
  });

  const ratingAgg = await db.mealReview.groupBy({
    by: ["mealId"],
    where: { businessId: business.id },
    _avg: { rating: true },
  });
  const ratingByMeal = new Map(ratingAgg.map((r) => [r.mealId, r._avg.rating ?? 0]));

  return (
    <Page>
      <Head
        kicker="Kitchen"
        title="Menu"
        sub="The meals your storefront sells. Add, edit, and toggle availability."
        right={
          <Link
            href="/dashboard/menu/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            <Plus size={15} /> Add menu item
          </Link>
        }
      />

      <div className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
        {meals.length} item{meals.length === 1 ? "" : "s"} on your menu
      </div>

      {meals.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <UtensilsCrossed
            size={24}
            className="mx-auto mb-3"
            style={{ color: "var(--muted)" }}
          />
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            No meals yet.
          </p>
          <Link
            href="/dashboard/menu/new"
            className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-2 rounded-lg text-[13px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            <Plus size={15} /> Add your first meal
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {meals.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border overflow-hidden flex flex-col"
              style={{
                borderColor: "var(--line)",
                background: "var(--surface)",
                boxShadow: "0 1px 2px rgba(31,30,26,.03)",
                opacity: m.active ? 1 : 0.6,
              }}
            >
              <div
                className="h-16 relative"
                style={{ background: `${m.swatch}1a` }}
              >
                {!m.active && (
                  <span
                    className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "var(--sand)", color: "var(--muted)" }}
                  >
                    Hidden
                  </span>
                )}
              </div>
              <div className="p-3.5 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "var(--ink)" }}
                  >
                    {m.name}
                  </span>
                  <span
                    className="disp text-[14px] font-medium shrink-0"
                    style={{ color: "var(--ink)" }}
                  >
                    {formatCents(m.priceCents)}
                  </span>
                </div>
                <div className="text-[12px] mb-3 flex items-center gap-2 flex-wrap" style={{ color: "var(--muted)" }}>
                  {m._count.reviews > 0 && (
                    <span className="flex items-center gap-0.5" style={{ color: "#c98a2b" }}>
                      <Star size={11} fill="#e0a53f" style={{ color: "#e0a53f" }} />
                      {(ratingByMeal.get(m.id) ?? 0).toFixed(1)}
                      <span style={{ color: "var(--muted)" }}>({m._count.reviews})</span>
                    </span>
                  )}
                  <span>
                    {m.diet ? `${m.diet} · ` : ""}
                    {m.calories} cal · {m._count.ingredients} ingredient
                    {m._count.ingredients === 1 ? "" : "s"}
                  </span>
                </div>

                <div
                  className="flex items-center gap-1.5 mt-auto pt-2 border-t"
                  style={{ borderColor: "var(--line)" }}
                >
                  <Link
                    href={`/dashboard/menu/${m.id}/edit`}
                    className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-md"
                    style={{ background: "var(--paper)", color: "var(--ink)" }}
                  >
                    <Pencil size={12} /> Edit
                  </Link>
                  <form action={toggleMealActive}>
                    <input type="hidden" name="mealId" value={m.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-md"
                      style={{ background: "var(--paper)", color: "var(--ink)" }}
                    >
                      {m.active ? <EyeOff size={12} /> : <Eye size={12} />}
                      {m.active ? "Hide" : "Show"}
                    </button>
                  </form>
                  <form action={deleteMeal} className="ml-auto">
                    <input type="hidden" name="mealId" value={m.id} />
                    <button
                      type="submit"
                      className="grid place-items-center w-7 h-7 rounded-md"
                      style={{
                        background: "var(--paper)",
                        border: "1px solid var(--line)",
                      }}
                      aria-label={`Delete ${m.name}`}
                    >
                      <Trash2 size={12} style={{ color: "var(--clay)" }} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
