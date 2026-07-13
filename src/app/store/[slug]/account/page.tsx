import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaf, Star } from "lucide-react";
import { SignIn, SignUp, UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { getStorefrontBusiness } from "@/lib/storefront";
import { getKitchenCustomer } from "@/lib/customer-auth";
import { canModifyNextDelivery, cutoffAt, advanceDeliveryDate } from "@/lib/subscriptions";
import { SubscriptionManager, type ManagerMeal } from "@/app/account/subscription-manager";
import { RateMeals, type ReviewableMeal } from "@/app/account/rate-meals";
import { DeliveryAddress } from "@/app/account/delivery-address";

export const dynamic = "force-dynamic";

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
      selections: { orderBy: { deliveryDate: "asc" }, include: { items: true }, take: 1 },
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
  });
  const managerMeals: ManagerMeal[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    priceCents: m.priceCents,
    diet: m.diet,
  }));

  const [orderedItems, myReviews] = await Promise.all([
    db.orderItem.findMany({
      where: { order: { customerId: customer.id }, mealId: { not: null } },
      select: { mealId: true, nameSnapshot: true },
    }),
    db.mealReview.findMany({ where: { customerId: customer.id }, select: { mealId: true, rating: true, comment: true } }),
  ]);
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

  // Cut-off countdown target + the next few delivery dates for the account UI.
  const nextDate = subscription?.nextDeliveryDate ?? null;
  const cutoffISO = nextDate ? cutoffAt(nextDate).toISOString() : null;
  const upcomingDates: string[] = [];
  if (nextDate && subscription) {
    let d = new Date(nextDate);
    for (let i = 0; i < 4; i++) {
      upcomingDates.push(dateFmt.format(d));
      d = advanceDeliveryDate(d, subscription.frequency as "weekly" | "biweekly");
    }
  }

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
          Manage your meal-plan subscription — pause, skip, or swap meals before the cut-off.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="text-[12px] mb-1" style={{ color: "var(--muted)" }}>Loyalty points</div>
          <div className="disp text-[28px] font-medium" style={{ color: "var(--pine)" }}>
            {customer.loyaltyPoints.toLocaleString()}
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
            Worth {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
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

      <div className="mb-4">
        <DeliveryAddress initial={address} />
      </div>

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
          nextDeliveryLabel={subscription.nextDeliveryDate ? dateFmt.format(subscription.nextDeliveryDate) : "—"}
          cutoffLabel={business.settings?.cutoff ?? "48h before delivery"}
          cutoffISO={cutoffISO}
          upcomingDates={upcomingDates}
          canModify={canModifyNextDelivery(
            subscription.status as "active" | "paused" | "canceled",
            new Date(),
            subscription.nextDeliveryDate,
          )}
          perMealPriceCents={subscription.plan.perMealPriceCents}
          initialSelection={Object.fromEntries(
            (subscription.selections[0]?.items ?? []).map((i) => [i.mealId, i.qty]),
          )}
          meals={managerMeals}
        />
      )}

      <div className="rounded-xl border p-5 mt-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Star size={16} style={{ color: "#e0a53f" }} />
          <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Rate your meals</h3>
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
            {clerkOn && showUser && <UserButton />}
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8 fade">{children}</main>
    </div>
  );
}
