import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { resetDb } from "@/lib/db-seed";

function req(url: string) {
  return new Request(`http://localhost${url}`);
}

describe("GET /api/pay", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // AC-10
  it("{summary, items} 형태를 반환하고 totalPay === Σ items.amount", async () => {
    const res = await GET(req("/api/pay?month=2026-05"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("items");

    const sum = body.items.reduce(
      (s: number, it: { amount: number }) => s + it.amount,
      0,
    );
    expect(body.summary.totalPay).toBe(sum);
    expect(body.summary.deductMinutes).toBe(440);
    expect(body.summary.overtimeCount).toBe(6);
    expect(body.summary.overtimeMinutes).toBe(544);
  });

  // 엣지#1: 빈 달 → 0원 요약
  it("시드 없는 달은 0원·빈 items", async () => {
    const res = await GET(req("/api/pay?month=2026-04"));
    const body = await res.json();
    expect(body.summary.totalPay).toBe(0);
    expect(body.items).toEqual([]);
  });
});
