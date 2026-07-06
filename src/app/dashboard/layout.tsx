import Link from "next/link";
import { Eye } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { exitStaffPreview } from "./staff/actions";

// The dashboard is authenticated, per-tenant, live data — render on request,
// never prerender at build (the build has no database). Applies to all /dashboard/* routes.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business, role } = await requireBusiness();

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
        role={role}
      />
      <main className="flex-1 min-w-0">
        {role === "staff" && (
          <div
            className="no-print flex items-center gap-3 px-6 py-2.5 text-[13px] flex-wrap"
            style={{ background: "var(--sidebar)", color: "#f4f2ec" }}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Eye size={14} style={{ color: "var(--clay)" }} /> Staff view
            </span>
            <span style={{ color: "#ffffff9a" }}>
              You&apos;re previewing what a staff member sees — money, customers, and settings are hidden.
            </span>
            <form action={exitStaffPreview} className="ml-auto">
              <button type="submit" className="px-3 py-1 rounded-md text-[12.5px] font-medium" style={{ background: "#ffffff1a", color: "#f4f2ec" }}>
                Exit staff view
              </button>
            </form>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
