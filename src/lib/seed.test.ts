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

  it("③ totalPay = Σ items.amount (주휴 포함)", () => {
    const sumItems = items.reduce((s, it) => s + it.amount, 0);
    expect(summary.totalPay).toBe(sumItems);
    // 주휴수당은 주 단위 산정(1주 총 근로시간 기준). 자격 주마다 1건.
    const weekly = items.filter((it) => it.isWeeklyHoliday);
    expect(weekly.length).toBeGreaterThanOrEqual(1);
    for (const w of weekly) {
      expect(w.amount).toBeGreaterThan(0); // 주 15시간 이상 주만 포함
      expect(w.amount).toBeLessThanOrEqual(8 * 10320); // 풀타임 8시간 상한
    }
  });

  // T7: 근무일에 휴게 범위(11:30~12:00) 부여 — 파생 30분 = 기존 breakMinutes(회귀 0).
  it("⑤ 근무일은 breakStart=11:30/breakEnd=12:00 범위를 갖고, 휴가일은 범위 미부여", () => {
    const work = records.find((r) => r.date === "2026-05-01");
    expect(work!.breakStart).toBe("11:30");
    expect(work!.breakEnd).toBe("12:00");
    expect(work!.breakMinutes).toBe(30); // 파생 = 기존값

    const vacation = records.find((r) => r.status === "휴가");
    expect(vacation!.breakStart).toBeUndefined();
    expect(vacation!.breakEnd).toBeUndefined();
    expect(vacation!.breakMinutes).toBe(0);
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
