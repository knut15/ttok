// vitest globalSetup — 테스트DB에 마이그레이션 적용(1회). 신원/운영 시드는 각 테스트 beforeEach(resetDb).
import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./db-url";

export default function setup() {
  execSync("pnpm prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
