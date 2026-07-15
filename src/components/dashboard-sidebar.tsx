"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccess, type Role } from "@/lib/permissions";
import { SignOutButton } from "@/components/sign-out-button";
import {
  ChevronDown,
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

// Dashboard navigation, grouped into labeled sections. Hrefs are real routes.
type NavItem = [href: string, label: string, icon: LucideIcon];

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      ["/dashboard", "Dashboard", LayoutDashboard],
      ["/dashboard/analytics", "Analytics", BarChart3],
      ["/dashboard/profitability", "Profitability", TrendingUp],
      ["/dashboard/reports", "Reports", FileSpreadsheet],
    ],
  },
  {
    label: "Sales",
    items: [
      ["/dashboard/menu", "Menu", ChefHat],
      ["/dashboard/plans", "Meal Plans", Repeat],
      ["/dashboard/subscriptions", "Subscriptions", CalendarClock],
      ["/dashboard/orders", "Orders", Receipt],
      ["/dashboard/customers", "Customers", User],
      ["/dashboard/pos", "POS Terminal", Wallet],
    ],
  },
  {
    label: "Kitchen",
    items: [
      ["/dashboard/kitchen", "Kitchen OS", ChefHat],
      ["/dashboard/kds", "Kitchen Display", Monitor],
      ["/dashboard/purchasing", "Purchasing", Carrot],
      ["/dashboard/inventory", "Inventory", Boxes],
      ["/dashboard/fulfillment", "Labels & packing", Tag],
      ["/dashboard/routes", "Delivery Routes", Truck],
    ],
  },
  {
    label: "Marketing",
    items: [
      ["/dashboard/marketing", "Marketing", Megaphone],
      ["/dashboard/share", "Share links", Share2],
    ],
  },
  {
    label: "Admin",
    items: [
      ["/dashboard/payouts", "Payouts", Landmark],
      ["/dashboard/staff", "Staff", Users],
      ["/dashboard/import", "Import data", Upload],
      ["/dashboard/settings", "Settings", Cog],
    ],
  },
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

  // Which groups are collapsed, persisted across reloads. Starts all-expanded
  // to match SSR, then hydrates the saved state after mount (avoids mismatch).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pf_sidebar_collapsed");
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* ignore malformed/unavailable storage */
    }
  }, []);
  const toggleGroup = (label: string) =>
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem("pf_sidebar_collapsed", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

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
      <div className="flex flex-col gap-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(([href]) => canAccess(role, href));
          if (items.length === 0) return null;
          const isCollapsed = !!collapsed[group.label];
          const groupActive = items.some(([href]) => isActive(href));
          return (
            <div key={group.label}>
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center gap-1.5 px-3 py-1 mb-0.5 rounded-md"
                aria-expanded={!isCollapsed}
              >
                <span
                  className="text-[10px] font-semibold tracking-[0.14em] uppercase"
                  style={{ color: "#ffffff40" }}
                >
                  {group.label}
                </span>
                {/* When collapsed, flag the group that holds the current page. */}
                {isCollapsed && groupActive && (
                  <span className="w-1 h-1 rounded-full" style={{ background: "var(--clay)" }} />
                )}
                <ChevronDown
                  size={13}
                  className="ml-auto transition-transform"
                  style={{
                    color: "#ffffff40",
                    transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              {!isCollapsed && (
                <nav className="flex flex-col gap-0.5">
                  {items.map(([href, label, Icon]) => {
                    const on = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-[13.5px] transition-colors text-left"
                        style={{
                          background: on ? "#ffffff0e" : "transparent",
                          color: on ? "#f4f2ec" : "#ffffff7a",
                          fontWeight: on ? 500 : 450,
                        }}
                      >
                        <Icon size={17} style={{ opacity: on ? 1 : 0.7 }} />
                        {label}
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
              )}
            </div>
          );
        })}
      </div>
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
