import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { __resetStore } from "@/lib/store";

function ctx(date: string) {
  return { params: Promise.resolve({ date }) };
}
const req = new Request("http://localhost/api/pay/x");

describe("GET /api/pay/[date]", () => {
  beforeEach(() => __resetStore());

  // AC-18: amount === paidMinutes × wage 검산
  it("일별 급여 상세를 반환하고 amount = 급여인정시간 × 시급", () => {
    return GET(req, ctx("2026-05-28")).then(async (res) => {
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.hourlyWage).toBe(10320);
      expect(body.paidMinutes).toBe(390);
      expect(body.breakRange).toBe("11:30~12:00");
      expect(body.amount).toBe(Math.round((390 / 60) * 10320));
      expect(body.amount).toBe(67080);
    });
  });

  it("존재하지 않는 날짜는 404", async () => {
    const res = await GET(req, ctx("2026-05-30"));
    expect(res.status).toBe(404);
  });
});
