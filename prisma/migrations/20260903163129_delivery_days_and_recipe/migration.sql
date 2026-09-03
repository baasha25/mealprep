-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "methodSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prepNotes" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "preferredDeliveryDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
