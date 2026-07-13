"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccess, type Role } from "@/lib/permissions";
import { SignOutButton } from "@/components/sign-out-button";
import {
  LayoutDashboard,
  Receipt,
  ChefHat,
  Megaphone,
  Settings as Cog,
  Truck,
  Users,
  Wallet,
  Leaf,
  Carrot,
  Upload,
  User,
  Tag,
  BarChart3,
  Boxes,
  Monitor,
  TrendingUp,
  FileSpreadsheet,
  Repeat,
  Share2,
  Landmark,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

// Dashboard navigation — ports the demo's NAV. Hrefs are real routes; pages
// arrive incrementally through Phase 0/1. Items without a page yet are marked.
const NAV: [string, string, LucideIcon, boolean][] = [
  ["/dashboard", "Dashboard", LayoutDashboard, true],
  ["/dashboard/analytics", "Analytics", BarChart3, true],
  ["/dashboard/profitability", "Profitability", TrendingUp, true],
  ["/dashboard/reports", "Reports", FileSpreadsheet, true],
  ["/dashboard/menu", "Menu", ChefHat, true],
  ["/dashboard/plans", "Meal Plans", Repeat, true],
  ["/dashboard/subscriptions", "Subscriptions", CalendarClock, true],
  ["/dashboard/orders", "Orders", Receipt, true],
  ["/dashboard/customers", "Customers", User, true],
  ["/dashboard/kitchen", "Kitchen OS", ChefHat, true],
  ["/dashboard/kds", "Kitchen Display", Monitor, true],
  ["/dashboard/purchasing", "Purchasing", Carrot, true],
  ["/dashboard/inventory", "Inventory", Boxes, true],
  ["/dashboard/fulfillment", "Labels & packing", Tag, true],
  ["/dashboard/routes", "Delivery Routes", Truck, true],
  ["/dashboard/pos", "POS Terminal", Wallet, true],
  ["/dashboard/payouts", "Payouts", Landmark, true],
  ["/dashboard/marketing", "Marketing", Megaphone, true],
  ["/dashboard/share", "Share links", Share2, true],
  ["/dashboard/staff", "Staff", Users, true],
  ["/dashboard/import", "Import data", Upload, true],
  ["/dashboard/settings", "Settings", Cog, true],
];

export function DashboardSidebar({
  businessName,
  stats,
  role,
  authEnabled,
}: {
  businessName: string;
  stats: string;
  role: Role;
  authEnabled: boolean;
}) {
  const pathname = usePathname();
  const nav = NAV.filter(([href]) => canAccess(role, href));

  return (
    <aside
      className="no-print w-[224px] shrink-0 flex flex-col px-3 py-5 sticky top-0 h-screen overflow-y-auto"
      style={{ background: "var(--sidebar)" }}
    >
      <Link href="/" className="flex items-center gap-2.5 px-3 mb-7">
        <div
          className="grid place-items-center w-8 h-8 rounded-md"
          style={{ background: "var(--pine)" }}
        >
          <Leaf size={17} color="#f4f2ec" />
        </div>
        <div className="disp text-[19px] font-medium text-[#f4f2ec]">
          PrepFlow
        </div>
      </Link>
      <div
        className="px-3 text-[10px] font-semibold tracking-[0.14em] uppercase mb-2"
        style={{ color: "#ffffff40" }}
      >
        Workspace
      </div>
      <nav className="flex flex-col gap-0.5">
        {nav.map(([href, label, Icon, live]) => {
          const on =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={live ? href : "#"}
              aria-disabled={!live}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] transition-colors text-left"
              style={{
                background: on ? "#ffffff0e" : "transparent",
                color: on ? "#f4f2ec" : live ? "#ffffff7a" : "#ffffff45",
                fontWeight: on ? 500 : 450,
                pointerEvents: live ? "auto" : "none",
              }}
            >
              <Icon size={17} style={{ opacity: on ? 1 : 0.7 }} />
              {label}
              {!live && (
                <span
                  className="ml-auto text-[9px] uppercase tracking-wide"
                  style={{ color: "#ffffff35" }}
                >
                  soon
                </span>
              )}
              {on && (
                <span
                  className="ml-auto w-1 h-1 rounded-full"
                  style={{ background: "var(--clay)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div
        className="mt-auto mx-1 rounded-lg px-3.5 py-3"
        style={{ background: "#ffffff0a", border: "1px solid #ffffff12" }}
      >
        <div className="text-[#f4f2ec] text-[13px] font-medium mb-0.5">
          {businessName}
        </div>
        <p className="text-[11px] leading-snug" style={{ color: "#ffffff5c" }}>
          {stats}
        </p>
        {authEnabled && <SignOutButton />}
      </div>
    </aside>
  );
}
