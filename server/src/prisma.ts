import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
};

// Reuses a single PrismaClient in dev (avoids too many connections)
export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
    });
// Caches it on global in non-prod for reload reuse of same instance 
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

