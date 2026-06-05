// Prisma Client 싱글톤(server-only). 인메모리 store 의 globalThis 가드 패턴 미러 —
// dev HMR 로 연결이 중복 생성되는 것을 방지. client 직접 import 금지(Route Handler 경유).
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  g.__prisma ??
  new PrismaClient({
    // perf/observability: prod 는 error 만(로그 I/O 최소화), dev 는 warn+error.
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
