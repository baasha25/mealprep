-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "isAddOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "upsellPrompt" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "addedVia" TEXT;
