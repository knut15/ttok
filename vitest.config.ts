import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_URL } from "./test/db-url";

// 운영 데이터가 Prisma/Postgres 단일 진실원이므로 테스트는 테스트DB에서 직렬 실행.
// (공유 DB에 per-test truncate/reseed → 병렬 시 충돌 → fileParallelism:false)
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: "./test/global-setup.ts",
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
