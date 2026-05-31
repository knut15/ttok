import { describe, it, expect } from "vitest";
import { buildSeedRecords, buildPayItems } from "./seed";
import { buildPaySummary } from "./pay";

// architect §3.3 / §5: 시드 불변식 — 자의적 구성 금지, summary 제약 우선.
describe("seed 불변식", () => {
  const records = buildSeedRecords();
  const items = buildPayItems(records);
  const deductMinutes = records.reduce((s, r) => s + r.deductMinutes, 0);
  const summary = buildPaySummary(items, { deductMinutes });

  it("① 급여차감시간 합계 = 440분", () => {
    expect(summary.deductMinutes).toBe(440);
  });

  it("② 연장 6회 / 합계 544분(9시간4분)", () => {
    expect(summary.overtimeCount).toBe(6);
    expect(summary.overtimeMinutes).toBe(544);
  });

  it("③ totalPay = Σ items.amount (주휴 67,080원 포함)", () => {
    const sumItems = items.reduce((s, it) => s + it.amount, 0);
    expect(summary.totalPay).toBe(sumItems);
    // 주휴수당 블루행이 정확히 1건, 67,080원
    const weekly = items.filter((it) => it.isWeeklyHoliday);
    expect(weekly).toHaveLength(1);
    expect(weekly[0].amount).toBe(67080);
  });

  it("근무일(월~금) 레코드가 시드에 존재한다", () => {
    expect(records.some((r) => r.date === "2026-05-28" && r.status === "정상")).toBe(true);
    expect(records.some((r) => r.status === "휴가")).toBe(true);
  });
});
