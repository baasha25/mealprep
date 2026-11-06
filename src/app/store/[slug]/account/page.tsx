import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaf, Star } from "lucide-react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { SignOutButton } from "@/components/sign-out-button";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { getKitchenCustomer } from "@/lib/customer-auth";
import { canModifyNextDelivery, deliveryLockAt } from "@/lib/subscriptions";
import {
  currentCycleDeliveries,
  upcomingDeliveries,
  formatDeliveryLabel,
  DEFAULT_TIMEZONE,
} from "@/lib/cutoff";
import { enabledDeliveryDays, sanitizePreferredDays, describeDeliveryDays } from "@/lib/delivery-days";
import { zoneForPostal, zoneDays, kitchenDaysWithZones, type ZoneLike } from "@/lib/zones";
import { formatCents } from "@/lib/money";
import { picksFromSnapshot } from "@/lib/meal-options";
import { nounsFor } from "@/lib/nouns";
import { SubscriptionManager, type ManagerMeal, type DeliverySlot } from "@/app/account/subscription-manager";
import { RateMeals, type ReviewableMeal } from "@/app/account/rate-meals";
import { DeliveryAddress } from "@/app/account/delivery-address";
import { updateSmsPrefs } from "@/app/account/actions";
import { revenueStatusWhere } from "@/lib/order-status";
import { Heart, RotateCcw, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";
// Personal pages: never in search results.
export const metadata = { robots: { index: false, follow: false } };

export default async function KitchenAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ signup?: string }>;
}) {
  const { slug } = await params;
  const { signup } = await searchParams;
  const business = await getStorefrontBusiness(slug);
  if (!business) notFound();

  const N = nounsFor(business.settings?.itemNoun);
  const storeHref = `/store/${slug}`;
  const accountHref = `/store/${slug}/account`;
  const { signedIn, customer } = await getKitchenCustomer(business.id);

  // Signed out → kitchen-branded sign-in (or sign-up when ?signup), embedded right
  // here. After auth the customer returns to THIS account — never the owner flow.
  if (!signedIn) {
    const joining = signup !== undefined;
    return (
      <Shell businessName={business.name} brandColor={business.brandColor} storeHref={storeHref} showUser={false}>
        <div className="max-w-md mx-auto text-center mb-6">
          <h1 className="disp text-[26px] font-medium" style={{ color: "var(--ink)" }}>
            {joining ? `Join ${business.name}` : `Your ${business.name} account`}
          </h1>
          <p className="text-[13.5px] mt-2" style={{ color: "var(--ink-soft)" }}>
            {joining
              ? "Create an account to subscribe, earn loyalty points, and reorder faster."
              : "Sign in to manage your subscription, track loyalty points, and reorder faster."}
          </p>
        </div>
        <div className="flex justify-center">
          {joining ? (
            <SignUp
              routing="hash"
              fallbackRedirectUrl={accountHref}
              signInFallbackRedirectUrl={accountHref}
            />
          ) : (
            <SignIn
              routing="hash"
              fallbackRedirectUrl={accountHref}
              signUpFallbackRedirectUrl={accountHref}
            />
          )}
        </div>
      </Shell>
    );
  }

  // Signed in but no orders from this kitchen yet.
  if (!customer) {
    return (
      <Shell businessName={business.name} brandColor={business.brandColor} storeHref={storeHref} showUser>
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            You haven&apos;t ordered from {business.name} yet.
          </p>
          <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
            Once you place an order, your subscription and loyalty show up here.
          </p>
          <Link
            href={storeHref}
            className="inline-block mt-4 px-4 py-2 rounded-lg text-[13px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            Browse the menu
          </Link>
        </div>
      </Shell>
    );
  }

  const subscription = await db.subscription.findFirst({
    where: { customerId: customer.id, status: { not: "canceled" } },
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
      selections: { include: { items: true } },
    },
  });

  const address = await db.address.findFirst({
    where: { customerId: customer.id },
    orderBy: { id: "asc" },
    select: { line1: true, city: true, region: true, postalCode: true },
  });

  const meals = await db.meal.findMany({
    where: { businessId: business.id, active: true },
    orderBy: { createdAt: "asc" },
    include: { optionGroups: { orderBy: { sortOrder: "asc" }, include: { options: { where: { active: true }, orderBy: { sortOrder: "asc" } } } } },
  });
  const managerMeals: ManagerMeal[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    priceCents: m.priceCents,
    diet: m.diet,
    optionGroups: m.optionGroups
      .filter((g) => g.options.length > 0)
      .map((g) => ({ id: g.id, name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, options: g.options.map((o) => ({ id: o.id, name: o.name, priceDeltaCents: o.priceDeltaCents, isDefault: o.isDefault })) })),
  }));

  const [orderedItems, myReviews, lastOrder] = await Promise.all([
    db.orderItem.findMany({
      where: { order: { customerId: customer.id }, mealId: { not: null } },
      select: { mealId: true, nameSnapshot: true },
    }),
    db.mealReview.findMany({ where: { customerId: customer.id }, select: { mealId: true, rating: true, comment: true } }),
    db.order.findFirst({
      where: { customerId: customer.id, type: { in: ["one_time", "pos"] }, ...revenueStatusWhere },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, items: { select: { mealId: true, qty: true, nameSnapshot: true, optionsSnapshot: true } } },
    }),
  ]);
  // "Same as last time": only plain meals (no option choices) can be re-added in one tap.
  const reorderIds: string[] = [];
  const reorderNames: string[] = [];
  for (const it of lastOrder?.items ?? []) {
    if (!it.mealId || !meals.some((m) => m.id === it.mealId && m.optionGroups.length === 0)) continue;
    for (let i = 0; i < it.qty; i++) reorderIds.push(it.mealId);
    reorderNames.push(`${it.qty} × ${it.nameSnapshot}`);
  }
  const favourites = meals.filter((m) => customer.favoriteMealIds.includes(m.id));
  const smsAvailable = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) && (business.settings?.notifyCutoffSms ?? false);
  const reviewByMeal = new Map(myReviews.map((r) => [r.mealId, r]));
  const activeMealIds = new Set(meals.map((m) => m.id));
  const seenMeal = new Set<string>();
  const reviewableMeals: ReviewableMeal[] = [];
  for (const it of orderedItems) {
    if (!it.mealId || seenMeal.has(it.mealId) || !activeMealIds.has(it.mealId)) continue;
    seenMeal.add(it.mealId);
    const r = reviewByMeal.get(it.mealId);
    reviewableMeals.push({ id: it.mealId, name: it.nameSnapshot, rating: r?.rating ?? 0, comment: r?.comment ?? "" });
  }

  const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

  // Cut-off countdown target + the delivery days/dates for the account UI.
  const tz = business.settings?.timezone || DEFAULT_TIMEZONE;
  // Zone kitchens: the subscriber's zone (postal code from sign-up, else their
  // saved address) decides which days they can choose and what delivery costs.
  const zoneRows = await db.deliveryZone.findMany({ where: { businessId: business.id, active: true } });
  const zones: ZoneLike[] = zoneRows.map((z) => ({ ...z, deliveryDays: (z.deliveryDays ?? {}) as Record<string, boolean> }));
  const kitchenDayMap = kitchenDaysWithZones((business.settings?.deliveryDays ?? {}) as Record<string, boolean>, zones);
  const zone = zoneForPostal(subscription?.postalCode ?? address?.postalCode, zones);
  const enabledDays = enabledDeliveryDays(zoneDays(zone, kitchenDayMap));
  const zoneLine = zone
    ? `${zone.name} · ${describeDeliveryDays(enabledDays)} · ${(subscription?.deliveryFeeCents ?? 0) > 0 ? `${formatCents(subscription!.deliveryFeeCents)} delivery each week` : "free delivery"}`
    : zones.length && subscription
      ? "Save your delivery address below so we can place you in a delivery zone."
      : null;
  const nextDate = subscription?.nextDeliveryDate ?? null;
  const cutoffRule = business.settings ? { cutoff: business.settings.cutoff, timezone: business.settings.timezone } : null;
  const lockAt = nextDate ? deliveryLockAt(nextDate, cutoffRule) : null;
  const cutoffISO = lockAt ? lockAt.toISOString() : null;
  const chosenDays = subscription
    ? sanitizePreferredDays(subscription.preferredDeliveryDays, enabledDays)
    : [];
  const freq = (subscription?.frequency ?? "weekly") as "weekly" | "biweekly";

  // The 1–2 deliveries the customer can edit this cycle, each with its own meals.
  // Each delivery's picks as lines (a meal can appear with different options).
  const selByDate = new Map(
    (subscription?.selections ?? []).map((s) => [
      s.deliveryDate.getTime(),
      s.items.map((i) => ({ mealId: i.mealId, qty: i.qty, optionIds: picksFromSnapshot(i.optionsSnapshot).map((p) => p.optionId) })),
    ]),
  );
  const deliveries: DeliverySlot[] =
    nextDate && subscription
      ? currentCycleDeliveries(chosenDays, nextDate, tz).map((d) => ({
          dateISO: d.toISOString(),
          label: dateFmt.format(d),
          fullLabel: formatDeliveryLabel(d, tz),
          selection: selByDate.get(d.getTime()) ?? [],
        }))
      : [];

  // Upcoming deliveries further out (both days when the customer picked two).
  const upcomingDates: string[] =
    nextDate && subscription && chosenDays.length
      ? upcomingDeliveries(chosenDays, lockAt!, tz, 4, freq).map((d) => dateFmt.format(d))
      : nextDate
        ? [dateFmt.format(nextDate)]
        : [];

  return (
    <Shell businessName={business.name} brandColor={business.brandColor} storeHref={storeHref} showUser>
      <div className="mb-7">
        <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase mb-2.5" style={{ color: "var(--muted)" }}>
          Your account
        </div>
        <h1 className="disp text-[30px] leading-none font-medium" style={{ color: "var(--ink)" }}>
          Hi {customer.name.split(" ")[0]}
        </h1>
        <p className="text-[13.5px] mt-2.5" style={{ color: "var(--ink-soft)" }}>
          Manage your plan — pause, skip, or swap {N.many} before the cut-off.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="text-[12px] mb-1" style={{ color: "var(--muted)" }}>Loyalty points</div>
          <div className="disp text-[28px] font-medium" style={{ color: "var(--pine)" }}>
            {customer.loyaltyPoints.toLocaleString()}
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
            Worth {new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
              (customer.loyaltyPoints * (business.settings?.loyaltyRedeemCentsPerPoint ?? 5)) / 100,
            )}{" "}
            off your next order · earn 1 per $1 spent
          </div>
        </div>
        {customer.referralCode && (
          <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <div className="text-[12px] mb-1" style={{ color: "var(--muted)" }}>Your referral code</div>
            <div className="disp text-[24px] font-medium font-mono" style={{ color: "var(--ink)" }}>
              {customer.referralCode}
            </div>
            <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
              Share it — friends enter it at checkout and you earn{" "}
              {business.settings?.referralBonusPoints ?? 100} points per signup.
            </div>
          </div>
        )}
      </div>

      {(reorderIds.length > 0 || favourites.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          {reorderIds.length > 0 && (
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <div className="flex items-center gap-2 mb-1"><RotateCcw size={15} style={{ color: "var(--pine)" }} /><div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>Same as last time</div></div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>{reorderNames.slice(0, 4).join(" · ")}{reorderNames.length > 4 ? " · …" : ""}</div>
              <Link href={`${storeHref}?add=${reorderIds.join(",")}`} className="inline-block mt-3 px-3.5 py-2 rounded-lg text-[13px] font-medium" style={{ background: "var(--pine)", color: "#f4f2ec" }}>Reorder {reorderIds.length} {N.many}</Link>
            </div>
          )}
          {favourites.length > 0 && (
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
              <div className="flex items-center gap-2 mb-1"><Heart size={15} style={{ color: "var(--clay)" }} /><div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>Your favourites</div></div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-soft)" }}>{favourites.slice(0, 5).map((m) => m.name).join(" · ")}{favourites.length > 5 ? " · …" : ""}</div>
              {favourites.some((m) => m.optionGroups.length === 0) ? (
                <Link href={`${storeHref}?add=${favourites.filter((m) => m.optionGroups.length === 0).map((m) => m.id).join(",")}`} className="inline-block mt-3 px-3.5 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Add them all to an order</Link>
              ) : (
                <Link href={storeHref} className="inline-block mt-3 px-3.5 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Order them (pick your options)</Link>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <DeliveryAddress initial={address} />
      </div>

      {smsAvailable && (
        <form action={updateSmsPrefs} className="rounded-xl border p-5 mb-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-1"><MessageSquare size={15} style={{ color: "var(--pine)" }} /><div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>Text reminders</div></div>
          <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>A text two days before your picks lock and one on the day, so a forgotten week never happens. Reply STOP to any text to opt out.</p>
          <div className="flex flex-wrap items-center gap-3">
            <input name="phone" type="tel" autoComplete="tel" defaultValue={customer.phone ?? ""} placeholder="Mobile number" className="px-3 py-2 rounded-md border text-[13px] outline-none" style={{ borderColor: "var(--line)", background: "var(--paper)", color: "var(--ink)" }} />
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--ink)" }}><input type="checkbox" name="smsOptIn" defaultChecked={customer.smsOptIn} /> Text me before the cut-off</label>
            <button type="submit" className="px-3.5 py-2 rounded-lg text-[13px] font-medium border" style={{ borderColor: "var(--line)", color: "var(--ink)" }}>Save</button>
          </div>
        </form>
      )}

      {!subscription ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <p className="text-[14px]" style={{ color: "var(--ink)" }}>
            You don&apos;t have an active subscription.
          </p>
          <Link
            href={storeHref}
            className="inline-block mt-4 px-4 py-2 rounded-lg text-[13px] font-medium"
            style={{ background: "var(--pine)", color: "#f4f2ec" }}
          >
            Browse meal plans
          </Link>
        </div>
      ) : (
        <SubscriptionManager
          subscriptionId={subscription.id}
          status={subscription.status as "active" | "paused" | "canceled"}
          planName={subscription.plan.name}
          frequencyLabel={subscription.frequency === "weekly" ? "Weekly" : "Every 2 weeks"}
          nextDeliveryLabel={deliveries[0]?.label ?? (nextDate ? dateFmt.format(nextDate) : "—")}
          cutoffLabel={business.settings?.cutoff ?? "48h before delivery"}
          cutoffISO={cutoffISO}
          upcomingDates={upcomingDates}
          canModify={canModifyNextDelivery(
            subscription.status as "active" | "paused" | "canceled",
            new Date(),
            subscription.nextDeliveryDate,
            cutoffRule,
          )}
          perMealPriceCents={subscription.plan.perMealPriceCents}
          planMeals={subscription.plan.mealsPerWeek}
          deliveries={deliveries}
          chosenDays={chosenDays}
          allDeliveryDays={enabledDays}
          zoneLine={zoneLine}
          nouns={N}
          meals={managerMeals}
        />
      )}

      <div className="rounded-xl border p-5 mt-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Star size={16} style={{ color: "#e0a53f" }} />
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Rate your {N.many}</h3>
        </div>
        <p className="text-[12.5px] mb-1" style={{ color: "var(--muted)" }}>
          Your ratings help other diners and the kitchen improve.
        </p>
        <RateMeals meals={reviewableMeals} />
      </div>
    </Shell>
  );
}

function Shell({
  children,
  businessName,
  brandColor,
  storeHref,
  showUser,
}: {
  children: React.ReactNode;
  businessName: string;
  brandColor?: string;
  storeHref: string;
  showUser: boolean;
}) {
  const clerkOn = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--paper)", "--pine": brandColor ?? "#2f4536" } as React.CSSProperties}
    >
      <header className="border-b" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center w-8 h-8 rounded-md" style={{ background: "var(--pine)" }}>
              <Leaf size={17} color="#f4f2ec" />
            </div>
            <div className="disp text-[18px] font-medium" style={{ color: "var(--ink)" }}>
              {businessName}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href={storeHref} className="text-[13px] font-medium" style={{ color: "var(--pine)" }}>
              Order more →
            </Link>
            {clerkOn && showUser && <SignOutButton tone="link" />}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8 fade">{children}</main>
    </div>
  );
}
