"use client";

import { useState } from "react";
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
  Trash2,
  CreditCard,
  BookOpen,
  Calculator,
  PanelLeftClose,
  PanelLeftOpen,
  LifeBuoy,
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
      ["/dashboard/costs", "Operating Costs", Calculator],
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
      ["/dashboard/waste", "Waste & Loss", Trash2],
      ["/dashboard/fulfillment", "Labels & Packing Slips", Tag],
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
      ["/dashboard/billing", "Billing & plan", CreditCard],
      ["/dashboard/payouts", "Payouts", Landmark],
      ["/dashboard/staff", "Staff", Users],
      ["/dashboard/import", "Import data", Upload],
      ["/dashboard/settings", "Settings", Cog],
    ],
  },
  {
    label: "Help",
    items: [
      ["/dashboard/guide", "Guide", BookOpen],
      ["/dashboard/support", "Contact support", LifeBuoy],
    ],
  },
];

export function DashboardSidebar({
  businessName,
  logoUrl,
  stats,
  role,
  authEnabled,
}: {
  businessName: string;
  logoUrl?: string | null;
  stats: string;
  role: Role;
  authEnabled: boolean;
}) {
  const pathname = usePathname();

  // The sidebar always opens CLOSED: the whole thing starts as an icon-only
  // rail, and every section starts collapsed. State is session-only (survives
  // in-app navigation since the layout stays mounted, resets on a fresh load),
  // so it reliably starts closed on both the live dashboard and the demo.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.label, true])),
  );
  const [rail, setRail] = useState(true);
  const toggleGroup = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  const toggleRail = () => setRail((prev) => !prev);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const railToggle = (
    <button
      type="button"
      onClick={toggleRail}
      aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!rail}
      title={rail ? "Expand sidebar" : "Collapse sidebar"}
      className="grid place-items-center w-7 h-7 rounded-md shrink-0 transition-colors hover:bg-[#ffffff14]"
      style={{ color: "#ffffff70" }}
    >
      {rail ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
    </button>
  );

  return (
    <aside
      className={`no-print shrink-0 flex flex-col py-5 sticky top-0 h-screen overflow-y-auto overflow-x-hidden transition-[width] duration-200 ${
        rail ? "w-[68px] px-2" : "w-[224px] px-3"
      }`}
      style={{ background: "var(--sidebar)" }}
    >
      {/* Brand + collapse toggle */}
      {rail ? (
        <div className="flex flex-col items-center gap-2 mb-6">
          <Link
            href="/"
            title="PrepFlow — home"
            className="grid place-items-center w-9 h-9 rounded-md"
            style={{ background: "var(--pine)" }}
          >
            <Leaf size={18} color="#f4f2ec" />
          </Link>
          {railToggle}
        </div>
      ) : (
        <div className="flex items-center justify-between px-2 mb-7">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div
              className="grid place-items-center w-8 h-8 rounded-md shrink-0"
              style={{ background: "var(--pine)" }}
            >
              <Leaf size={17} color="#f4f2ec" />
            </div>
            <div className="disp text-[19px] font-medium text-[#f4f2ec] truncate">
              PrepFlow
            </div>
          </Link>
          {railToggle}
        </div>
      )}

      <div className={`flex flex-col ${rail ? "gap-1" : "gap-3"}`}>
        {NAV_GROUPS.map((group, gi) => {
          const items = group.items.filter(([href]) => canAccess(role, href));
          if (items.length === 0) return null;

          // ---- Collapsed rail: icon-only, no section headers, tooltips on hover.
          if (rail) {
            return (
              <div key={group.label} className="flex flex-col gap-0.5">
                {gi > 0 && (
                  <div className="h-px mx-2 mb-1.5 mt-0.5" style={{ background: "#ffffff12" }} />
                )}
                {items.map(([href, label, Icon]) => {
                  const on = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={label}
                      aria-label={label}
                      className="relative grid place-items-center w-9 h-9 mx-auto rounded-md transition-colors"
                      style={{
                        background: on ? "#ffffff16" : "transparent",
                        color: on ? "#f4f2ec" : "#ffffff7a",
                      }}
                    >
                      <Icon size={18} style={{ opacity: on ? 1 : 0.75 }} />
                      {on && (
                        <span
                          className="absolute -left-1 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
                          style={{ background: "var(--clay)" }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          }

          // ---- Expanded: labeled, collapsible section (unchanged behavior).
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

      {/* Business card — hidden in the collapsed rail to keep it clean. */}
      {!rail && (
        <div
          className="mt-auto mx-1 rounded-lg px-3.5 py-3"
          style={{ background: "#ffffff0a", border: "1px solid #ffffff12" }}
        >
          {logoUrl && (
            // Merchant's own logo, on a light chip so any colour reads on the dark card.
            <div
              className="inline-flex items-center rounded-md px-2 py-1 mb-2"
              style={{ background: "#f4f2ec" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={businessName} className="h-6 w-auto max-w-[150px] object-contain" />
            </div>
          )}
          <div className="text-[#f4f2ec] text-[13px] font-medium mb-0.5 truncate">
            {businessName}
          </div>
          <p className="text-[11px] leading-snug" style={{ color: "#ffffff5c" }}>
            {stats}
          </p>
          {authEnabled && <SignOutButton />}
        </div>
      )}
    </aside>
  );
}
