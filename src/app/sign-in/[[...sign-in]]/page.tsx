import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div
      className="min-h-screen grid place-items-center px-6 py-12"
      style={{ background: "var(--paper)" }}
    >
      <SignIn />
    </div>
  );
}
