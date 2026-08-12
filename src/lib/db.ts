import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Reuse a single PrismaClient across hot reloads in dev (avoids exhausting connections).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const url = process.env.DATABASE_URL ?? "";
  // Production runs on Neon over serverless functions — use Neon's HTTP/WebSocket
  // driver instead of a raw TCP pg connection. It connects far faster on cold
  // starts and won't exhaust Postgres connections under load. Local dev points at
  // a normal Postgres (localhost), which the Neon driver can't speak — so fall
  // back to node-postgres there. Chosen by the DB host, so no extra env needed.
  const isNeon = /neon\.tech/i.test(url);
  if (isNeon) {
    neonConfig.webSocketConstructor = ws; // WebSocket ctor for sessions/transactions in Node
    neonConfig.poolQueryViaFetch = true; // route simple queries over HTTP — lower latency
    const adapter = new PrismaNeon({ connectionString: url });
    return new PrismaClient({ adapter, log: ["error"] });
  }

  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
