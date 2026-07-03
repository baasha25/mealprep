-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('todo', 'cooking', 'done');

-- CreateTable
CREATE TABLE "ProductionTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mealId" TEXT,
    "mealName" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'todo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionTicket_businessId_idx" ON "ProductionTicket"("businessId");

