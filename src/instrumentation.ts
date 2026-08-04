import * as Sentry from "@sentry/nextjs";

/**
 * Server/edge error monitoring — entirely gated on SENTRY_DSN. With no DSN this
 * is a no-op (Sentry never initializes), so the app runs identically without it.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
  }
}

// Captures errors thrown in nested React Server Components (no-op until init).
export const onRequestError = Sentry.captureRequestError;
