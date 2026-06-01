import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { resetDb } from "@/lib/db-seed";

function ctx(date: string) {
  return { params: Promise.resolve({ date }) };
}
const req = new Request("http://localhost/api/attendance/x");

describe("GET /api/attendance/[date]", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // AC-7
  it("존재하는 날짜는 단일 상세를 200으로 반환한다", async () => {
    const res = await GET(req, ctx("2026-05-28"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2026-05-28");
    expect(body.clockIn).toBeTypeOf("string");
  });

  // AC-2(T12): 유효 날짜 형식인데 기록 없음 → 200 + body null (404→200 의도적 갱신)
  it("유효한 날짜 형식인데 기록이 없으면 200 + null 을 반환한다", async () => {
    const res = await GET(req, ctx("2026-05-30"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  // AC-2(T12): 잘못된 날짜 형식은 기존대로 404 (런타임 크래시 없음)
  it("잘못된 날짜 형식(2026-05-99)은 404", async () => {
    const res = await GET(req, ctx("2026-05-99"));
    expect(res.status).toBe(404);
  });
});
