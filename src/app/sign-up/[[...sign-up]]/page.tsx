import { SignUp } from "@clerk/nextjs";
import { AuthShell, AuthStubCard, clerkAppearance } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  // Local dev-stub mode has no Clerk keys, so the provider isn't mounted and the
  // card can't render; show what the page looks like instead of a 500.
  const clerkReady = Boolean(process.env.CLERK_SECRET_KEY);
  return (
    <AuthShell title="Start your 30-day free trial" blurb="Storefront, subscriptions, costing and the kitchen, in one login. No card needed.">
      {clerkReady ? <SignUp appearance={clerkAppearance} /> : <AuthStubCard />}
    </AuthShell>
  );
}
