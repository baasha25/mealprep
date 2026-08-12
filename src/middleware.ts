import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

/**
 * Route protection. Clerk activates only when CLERK_SECRET_KEY is set; until
 * then this is a pass-through so the dev-stub auth keeps the app working.
 *
 * Protected: the owner/staff dashboard and the new-owner onboarding flow.
 * The customer account (/store/[slug]/account) is intentionally NOT protected —
 * it renders its own kitchen-branded sign-in inline, so customers never get
 * bounced to the owner login/onboarding. Everything else is public.
 */
const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
]);
// Only the dashboard is reachable in demo mode — never /admin or /onboarding.
const isDemoAllowed = createRouteMatcher(["/dashboard(.*)"]);

const clerkHandler = process.env.CLERK_SECRET_KEY
  ? clerkMiddleware(async (auth, req) => {
      // The marketing landing is now a static page. A signed-in owner who hits
      // it goes straight to work — handled here so `/` itself stays static/CDN.
      if (req.nextUrl.pathname === "/") {
        const { userId } = await auth();
        if (userId) return NextResponse.redirect(new URL("/dashboard", req.url));
        return;
      }
      if (!isProtected(req)) return;
      // A present demo cookie lets the dashboard through WITHOUT Clerk. This is
      // safe: getAuthContext still verifies the signature and only ever loads a
      // business flagged isDemo — a forged/stale cookie falls back to sign-in.
      // Cookie name is inlined to keep node:crypto out of the edge bundle.
      const hasDemo = Boolean(req.cookies.get("pf_demo")?.value);
      if (hasDemo && isDemoAllowed(req)) return;
      await auth.protect();
    })
  : null;

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (clerkHandler) return clerkHandler(req, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except Next internals and files with an extension.
    "/((?!_next|.*\\..*).*)",
    "/",
  ],
};
