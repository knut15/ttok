// 테스트 전용 Postgres URL(로컬 Docker, dev DB와 분리). vitest config·globalSetup 공용.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://ttok:ttok@localhost:5433/ttok_test?schema=public";
