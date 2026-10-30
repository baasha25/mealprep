import { SignIn } from "@clerk/nextjs";
import { AuthShell, AuthStubCard, clerkAppearance } from "@/components/auth-shell";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  // Local dev-stub mode has no Clerk keys, so the provider isn't mounted and the
  // card can't render; show what the page looks like instead of a 500.
  const clerkReady = Boolean(process.env.CLERK_SECRET_KEY);
  return (
    <AuthShell title="Welcome back" blurb="Sign in to run your kitchen.">
      {clerkReady ? <SignIn appearance={clerkAppearance} /> : <AuthStubCard />}
    </AuthShell>
  );
}
