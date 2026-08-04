import * as Sentry from "@sentry/nextjs";

/**
 * Client error monitoring — gated on NEXT_PUBLIC_SENTRY_DSN. Inert without it.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
