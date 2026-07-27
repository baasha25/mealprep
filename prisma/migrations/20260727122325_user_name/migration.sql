-- Staff/user display name (set by the owner at invite; drives the dashboard greeting).
ALTER TABLE "User" ADD COLUMN "name" TEXT;
