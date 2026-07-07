import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";

/**
 * Route protection. Clerk activates only when CLERK_SECRET_KEY is set; until
 * then this is a pass-through so the dev-stub auth keeps the app working.
 *
 * Protected: the owner/staff dashboard, the customer account area, and the
 * new-owner onboarding flow. Everything else (landing, storefront, sign-in) is
 * public.
 */
const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/account(.*)",
  "/onboarding(.*)",
]);

const clerkHandler = process.env.CLERK_SECRET_KEY
  ? clerkMiddleware(async (auth, req) => {
      if (isProtected(req)) await auth.protect();
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
