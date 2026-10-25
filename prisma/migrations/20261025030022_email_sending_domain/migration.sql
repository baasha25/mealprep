-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "emailDomain" TEXT,
ADD COLUMN     "emailDomainId" TEXT,
ADD COLUMN     "emailDomainRecords" JSONB,
ADD COLUMN     "emailDomainStatus" TEXT,
ADD COLUMN     "emailFromLocal" TEXT NOT NULL DEFAULT 'hello',
ADD COLUMN     "emailReplyTo" TEXT;

