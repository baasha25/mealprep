-- AlterTable
ALTER TABLE "BusinessSettings" ALTER COLUMN "subNoPick" SET DEFAULT 'chef_choice';


-- Existing kitchens: auto-pick becomes the behaviour unless the owner chose Skip deliberately after this ships.
UPDATE "BusinessSettings" SET "subNoPick" = 'chef_choice' WHERE "subNoPick" = 'skip';
