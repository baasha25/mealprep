import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Page, Head } from "@/components/ui";
import { DEFAULT_TIMEZONE } from "@/lib/cutoff";
import { upcomingWeekStarts, weekLabel, isoWeekKey } from "@/lib/menu-week";
import { ScheduleEditor, type ScheduleWeek } from "./schedule-editor";

export const dynamic = "force-dynamic";

/**
 * Weekly menu scheduler: which meals are on for each of the next six weeks and
 * the one-line note the storefront shows that week. No selection = the whole
 * active menu, so a kitchen that never touches this sees no change.
 */
export default async function MenuSchedulePage() {
  const { business } = await requireOwner();
  const [settings, meals] = await Promise.all([
    db.businessSettings.findUnique({ where: { businessId: business.id }, select: { timezone: true } }),
    db.meal.findMany({ where: { businessId: business.id, active: true, perGuest: false }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, diet: true, priceCents: true } }),
  ]);
  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  const starts = upcomingWeekStarts(new Date(), tz, 6);
  const rows = await db.menuWeek.findMany({ where: { businessId: business.id, weekStart: { in: starts } }, select: { weekStart: true, mealIds: true, note: true } });
  const byKey = new Map(rows.map((r) => [isoWeekKey(r.weekStart), r]));
  const weeks: ScheduleWeek[] = starts.map((d, i) => {
    const r = byKey.get(isoWeekKey(d));
    return { weekStartISO: d.toISOString(), label: weekLabel(d, tz), isThisWeek: i === 0, mealIds: r?.mealIds ?? [], note: r?.note ?? "" };
  });

  return (
    <Page>
      <Link href="/dashboard/menu" className="inline-flex items-center gap-1.5 text-[12.5px] mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={14} /> Menu &amp; recipes
      </Link>
      <Head
        kicker="Kitchen"
        title="Weekly schedule"
        sub="Choose which meals are on each week and write the note customers see. Weeks you leave alone show the whole menu, exactly as now. The storefront shows the week of the next delivery (after the cut-off, that is next week), and subscribers pick from the week their delivery falls in."
      />
      <ScheduleEditor weeks={weeks} meals={meals} />
    </Page>
  );
}
