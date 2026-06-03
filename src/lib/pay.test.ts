import { describe, it, expect } from "vitest";
import {
  calcDailyPay,
  calcPaidMinutes,
  buildPaySummary,
  calcWeeklyHolidayPay,
  weeklyHolidayPaidMinutes,
  buildMonthStats,
} from "./pay";
import { buildPayItems } from "./seed";
import type { AttendanceRecord, PayItem } from "@/types";

function rec(p: Partial<AttendanceRecord> & { date: string }): AttendanceRecord {
  return {
    status: "정상",
    clockIn: "08:00",
    clockOut: "15:00",
    breakMinutes: 30,
    workMinutes: 390,
    overtimeMinutes: 0,
    deductMinutes: 0,
    clockInStatus: "정상",
    clockOutStatus: "정상",
    ...p,
  };
}

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

describe("buildMonthStats (월 집계 + 근무 안정성 레이더)", () => {
  const records: AttendanceRecord[] = [
    rec({ date: "2026-06-01" }),
    rec({ date: "2026-06-02", status: "지각", clockIn: "09:00", workMinutes: 330, deductMinutes: 60, clockInStatus: "지각" }),
    rec({ date: "2026-06-03", status: "결근", clockIn: null, clockOut: null, breakMinutes: 0, workMinutes: 0, deductMinutes: 390, clockInStatus: "결근" }),
    rec({ date: "2026-06-04", status: "휴가", clockIn: null, clockOut: null, breakMinutes: 0, workMinutes: 0, clockInStatus: "휴가" }),
    rec({ date: "2026-06-05", status: "연장", clockOut: "17:00", workMinutes: 510, overtimeMinutes: 120, clockOutStatus: "연장" }),
    rec({ date: "2026-06-06", clockOut: "14:00", workMinutes: 330, clockOutStatus: "조퇴" }),
  ];
  const stats = buildMonthStats(records, buildPayItems(records, 10320), 10320);

  it("월 집계가 정확하다", () => {
    expect(stats.hourlyWage).toBe(10320);
    expect(stats.workDays).toBe(4); // 정상2 + 지각1 + 연장1 (결근/휴가 제외)
    expect(stats.workMinutes).toBe(390 + 330 + 510 + 330);
    expect(stats.breakMinutes).toBe(120);
    expect(stats.lateCount).toBe(1);
    expect(stats.earlyLeaveCount).toBe(1);
    expect(stats.absentCount).toBe(1);
    expect(stats.vacationDays).toBe(1);
    expect(stats.overtimeCount).toBe(1);
    expect(stats.overtimeMinutes).toBe(120);
  });

  it("레이더 5축 점수가 산정된다(분모=출근예정 5일)", () => {
    const map = Object.fromEntries(stats.stability.map((a) => [a.label, a.score]));
    expect(stats.stability).toHaveLength(5);
    expect(map["출근"]).toBe(80); // 1-1/5
    expect(map["정시출근"]).toBe(80);
    expect(map["정시퇴근"]).toBe(80);
    expect(map["근무시간"]).toBe(100); // 1560/(4*390)
    expect(map["연장기여"]).toBe(20); // 120/600
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
