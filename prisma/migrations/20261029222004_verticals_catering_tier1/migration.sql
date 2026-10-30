-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "vertical" TEXT NOT NULL DEFAULT 'meal_prep';

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "cateringBalanceDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "cateringDepositBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cateringTerms" TEXT NOT NULL DEFAULT 'on_approval',
ADD COLUMN     "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1001,
ADD COLUMN     "invoicePrefix" TEXT NOT NULL DEFAULT 'INV';

-- AlterTable
ALTER TABLE "CateringRequest" ADD COLUMN     "balanceDueAt" TIMESTAMP(3),
ADD COLUMN     "balancePaidAt" TIMESTAMP(3),
ADD COLUMN     "chosenOption" INTEGER,
ADD COLUMN     "deliveryWindow" TEXT,
ADD COLUMN     "depositBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositPaidAt" TIMESTAMP(3),
ADD COLUMN     "dietary" JSONB,
ADD COLUMN     "invoiceDueAt" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "invoiceSentAt" TIMESTAMP(3),
ADD COLUMN     "invoiceTerms" TEXT,
ADD COLUMN     "options" JSONB;

-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "perGuest" BOOLEAN NOT NULL DEFAULT false;

