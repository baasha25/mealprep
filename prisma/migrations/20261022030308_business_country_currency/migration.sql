-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CAD';
