import { UserProfile } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { Page, Head } from "@/components/ui";

export const dynamic = "force-dynamic";

// Account & security: Clerk's profile panel, which is where an owner adds a
// second factor (authenticator app / SMS), changes their password, reviews
// active sessions and signs other devices out. Rendered only when Clerk auth is
// on; the local dev stub has no account to manage.
export default async function AccountPage() {
  await requireBusiness();
  const authEnabled = Boolean(process.env.CLERK_SECRET_KEY);

  return (
    <Page>
      <Head
        kicker="Account"
        title="Account & security"
        sub="Your sign-in, password, two-factor authentication and active sessions. Turn on two-factor here: it's the single best protection for your kitchen's data."
      />
      {authEnabled ? (
        <div className="rounded-xl border p-2 overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <UserProfile
            routing="hash"
            appearance={{
              variables: { colorPrimary: "#2f4536", borderRadius: "10px", fontFamily: "Inter, system-ui, sans-serif" },
              elements: { rootBox: "w-full", cardBox: "w-full shadow-none border-0", card: "shadow-none" },
            }}
          />
        </div>
      ) : (
        <div className="rounded-xl border p-5 flex items-start gap-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <ShieldCheck size={18} style={{ color: "var(--pine)", marginTop: 2 }} />
          <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
            Sign-in is handled locally in this development environment, so there is no account to manage here. On the live app this page holds your password, two-factor setup and active sessions.
          </p>
        </div>
      )}
    </Page>
  );
}
