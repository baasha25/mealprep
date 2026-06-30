import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

// The dashboard is authenticated, per-tenant, live data — render on request,
// never prerender at build (the build has no database). Applies to all /dashboard/* routes.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business } = await requireBusiness();

  const [mealCount, orderCount] = await Promise.all([
    db.meal.count({ where: { businessId: business.id, active: true } }),
    db.order.count({ where: { businessId: business.id } }),
  ]);

  return (
    // Inject the per-business brand color so --pine cascades through the dashboard.
    <div
      className="w-full min-h-screen flex"
      style={
        {
          background: "var(--paper)",
          "--pine": business.brandColor,
        } as React.CSSProperties
      }
    >
      <DashboardSidebar
        businessName={business.name}
        stats={`${mealCount} menu items · ${orderCount} orders`}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
