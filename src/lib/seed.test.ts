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

  // AC-T3-4: 5/28 실근무 인정 — clock 07:58~15:00, 휴게30 → 422-30=392분.
  // 정시 퇴근이라 연장 아님(overtime 0), 정상 유지. 일급=round(392/60×10320)=67424.
  it("④ 5/28 실근무 392분 인정 / overtime 0 / status 정상 / pay amount 67424", () => {
    const rec = records.find((r) => r.date === "2026-05-28");
    expect(rec!.status).toBe("정상");
    expect(rec!.clockIn).toBe("07:58"); // 실제 입력값 보존
    expect(rec!.workMinutes).toBe(392);
    expect(rec!.overtimeMinutes).toBe(0); // 정시 퇴근 → 연장 아님
    const item = items.find((it) => it.date === "2026-05-28");
    expect(item!.amount).toBe(67424); // 실근무 392분 기준 (정규 캡 없음)
  });
});
