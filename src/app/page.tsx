import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  // A signed-in owner landing on the marketing root goes straight to work.
  if (process.env.CLERK_SECRET_KEY) {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

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
          href="/sign-up"
          className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-paper bg-pine"
        >
          Start free
        </Link>
        <Link
          href="/sign-in"
          className="px-5 py-2.5 rounded-lg text-[14px] font-medium text-pine border border-pine"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
