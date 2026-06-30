import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="grid place-items-center w-12 h-12 rounded-lg mb-6 disp text-2xl font-medium text-paper bg-pine">
        P
      </div>
      <h1 className="disp text-[40px] leading-tight font-medium text-ink">
        PrepFlow
      </h1>
      <p className="mt-3 max-w-md text-[15px] text-ink-soft">
        The all-in-one platform for independent meal-prep kitchens — storefront,
        subscriptions, payments, and kitchen operations in one place.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-paper bg-pine"
        >
          Owner dashboard
        </Link>
        <Link
          href="/store"
          className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-pine border border-pine"
        >
          View storefront
        </Link>
      </div>
      <p className="mt-10 text-[12px] text-muted">
        Phase 0 — pilot build in progress.
      </p>
    </main>
  );
}
