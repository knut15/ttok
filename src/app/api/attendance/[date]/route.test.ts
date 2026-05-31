import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { __resetStore } from "@/lib/store";

function ctx(date: string) {
  return { params: Promise.resolve({ date }) };
}
const req = new Request("http://localhost/api/attendance/x");

describe("GET /api/attendance/[date]", () => {
  beforeEach(() => __resetStore());

  // AC-7
  it("존재하는 날짜는 단일 상세를 200으로 반환한다", async () => {
    const res = await GET(req, ctx("2026-05-28"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2026-05-28");
    expect(body.clockIn).toBeTypeOf("string");
  });

  // AC-7 / 엣지#5: 없는 날짜 일관 404
  it("존재하지 않는 날짜는 404", async () => {
    const res = await GET(req, ctx("2026-05-30"));
    expect(res.status).toBe(404);
  });
});
