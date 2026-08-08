-- Throwaway sales-demo tenants: isolated, read-write, no real side-effects, auto-deleted.
ALTER TABLE "Business" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
