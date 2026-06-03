import { describe, it, expect } from "vitest";
import {
  calcDailyPay,
  calcPaidMinutes,
  buildPaySummary,
  calcWeeklyHolidayPay,
  weeklyHolidayPaidMinutes,
} from "./pay";
import type { PayItem } from "@/types";

describe("calcDailyPay", () => {
  // AC-2
  it("급여인정 390분 × 시급 10,320원 = 67,080원", () => {
    expect(calcDailyPay({ paidMinutes: 390, hourlyWage: 10320 })).toBe(67080);
  });

  // AC-3
  it("휴가 상태면 0원을 반환한다", () => {
    expect(
      calcDailyPay({ paidMinutes: 390, hourlyWage: 10320, status: "휴가" }),
    ).toBe(0);
  });
});

describe("calcPaidMinutes", () => {
  // AC-3: 휴가 → 0분
  it("휴가 상태면 0분을 반환한다", () => {
    expect(
      calcPaidMinutes({ workMinutes: 390, deductMinutes: 0, status: "휴가" }),
    ).toBe(0);
  });

  // AC-5: paidMinutes = workMinutes - deductMinutes
  it("급여차감시간만큼 급여인정시간이 줄어든다", () => {
    expect(
      calcPaidMinutes({ workMinutes: 390, deductMinutes: 90, status: "정상" }),
    ).toBe(300);
  });

  // 엣지#3: 차감 > 근무 → 0 하한
  it("차감이 근무를 초과해도 음수가 되지 않는다", () => {
    expect(
      calcPaidMinutes({ workMinutes: 90, deductMinutes: 300, status: "정상" }),
    ).toBe(0);
  });
});

describe("calcWeeklyHolidayPay (주휴수당 — 1주 총 근로시간 기준)", () => {
  // 기본(15~40h): (시간/40)×8×시급. 주 20h·10,320원 → 41,280원
  it("주 20시간 → 41,280원", () => {
    expect(calcWeeklyHolidayPay({ weeklyWorkMinutes: 20 * 60, hourlyWage: 10320 })).toBe(41280);
  });
  // 풀타임(40h↑): 8×시급 상한. 주 45h → 82,560원
  it("주 45시간(풀타임) → 8시간 상한 82,560원", () => {
    expect(calcWeeklyHolidayPay({ weeklyWorkMinutes: 45 * 60, hourlyWage: 10320 })).toBe(82560);
  });
  it("정확히 주 40시간 → 82,560원", () => {
    expect(calcWeeklyHolidayPay({ weeklyWorkMinutes: 40 * 60, hourlyWage: 10320 })).toBe(82560);
  });
  // 주 15시간 미만 → 주휴 미발생(0)
  it("주 15시간 미만 → 0원", () => {
    expect(calcWeeklyHolidayPay({ weeklyWorkMinutes: 14 * 60, hourlyWage: 10320 })).toBe(0);
  });
  it("인정시간(분): 주 20h → 240분(4h), 풀타임 → 480분(8h), 미만 → 0", () => {
    expect(weeklyHolidayPaidMinutes(20 * 60)).toBe(240);
    expect(weeklyHolidayPaidMinutes(45 * 60)).toBe(480);
    expect(weeklyHolidayPaidMinutes(10 * 60)).toBe(0);
  });
});

describe("buildPaySummary", () => {
  // AC-10 불변식: totalPay === Σ items.amount (주휴 포함)
  it("totalPay 가 items 합계(주휴 포함)와 일치한다", () => {
    const items: PayItem[] = [
      { date: "2026-05-26", kind: "work", label: "6시간 30분", amount: 67080, overtimeMinutes: 0, isWeeklyHoliday: false },
      { date: "2026-05-25", kind: "work", label: "8시간", amount: 82560, overtimeMinutes: 120, isWeeklyHoliday: false },
      { date: "2026-05-29", kind: "vacation", label: "휴가", amount: 0, overtimeMinutes: 0, isWeeklyHoliday: false },
      { date: "2026-05-24", kind: "weekly_holiday", label: "주휴수당 6시간 30분", amount: 67080, overtimeMinutes: 0, isWeeklyHoliday: true },
    ];
    const summary = buildPaySummary(items, { deductMinutes: 90 });
    expect(summary.totalPay).toBe(67080 + 82560 + 0 + 67080);
    expect(summary.deductMinutes).toBe(90);
    expect(summary.overtimeCount).toBe(1);
    expect(summary.overtimeMinutes).toBe(120);
  });
});
