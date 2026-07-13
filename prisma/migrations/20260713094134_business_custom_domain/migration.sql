-- White-label: serve a kitchen's storefront on its own domain.
ALTER TABLE "Business" ADD COLUMN "customDomain" TEXT;
CREATE UNIQUE INDEX "Business_customDomain_key" ON "Business"("customDomain");
