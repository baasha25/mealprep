-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "labelConfig" JSONB NOT NULL DEFAULT '{"showBusinessName":true,"showMacros":true,"showAllergens":true,"showBestBy":true,"footer":""}';
