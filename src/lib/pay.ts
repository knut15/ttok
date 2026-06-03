// 급여/주휴/차감 계산 — 순수 함수 (부수효과 0, store 비의존). architect §3.1.

import type { WorkStatus, PayItem, PaySummary } from "@/types";

/** 급여인정시간(분) = 근무시간 - 급여차감시간. 휴가 0, 음수 하한 0. */
export function calcPaidMinutes(i: {
  workMinutes: number;
  deductMinutes: number;
  status: WorkStatus;
}): number {
  if (i.status === "휴가") return 0;
  return Math.max(0, i.workMinutes - i.deductMinutes);
}

export function calcDailyPay(i: {
  paidMinutes: number;
  hourlyWage: number;
  status?: string;
}): number {
  if (i.status === "휴가") return 0;
  return Math.round((i.paidMinutes / 60) * i.hourlyWage);
}

/**
 * 주휴 인정시간(분) — 1주 총 근로시간 기준.
 * - 주 15시간 미만 → 0(주휴 미발생).
 * - 주 15~40시간 → (주근로시간 / 40) × 8시간.
 * - 주 40시간 이상 → 8시간(풀타임 상한; min(시간,40) 으로 일원화).
 */
export function weeklyHolidayPaidMinutes(weeklyWorkMinutes: number): number {
  const hours = weeklyWorkMinutes / 60;
  if (hours < 15) return 0;
  const capped = Math.min(hours, 40);
  return Math.round((capped / 40) * 8 * 60);
}

/** 주휴수당(원) = 주휴 인정시간 × 시급. (검산: 주20h·10,320원 → 41,280 / 주45h → 82,560) */
export function calcWeeklyHolidayPay(i: { weeklyWorkMinutes: number; hourlyWage: number }): number {
  return Math.round((weeklyHolidayPaidMinutes(i.weeklyWorkMinutes) / 60) * i.hourlyWage);
}

/**
 * 월간 급여 요약 집계. O(n), n = 월 일수 ≤ 31.
 * totalPay = Σ items.amount (주휴 포함) — AC-10 불변식.
 * 연장은 work item 의 overtimeMinutes 합/회수.
 * deductMinutes 는 attendance 레코드 합산값을 외부 주입(급여 item 에 없는 도메인 값).
 */
export function buildPaySummary(
  items: PayItem[],
  extra: { deductMinutes: number },
): PaySummary {
  const totalPay = items.reduce((sum, it) => sum + it.amount, 0);
  const overtimeItems = items.filter((it) => it.overtimeMinutes > 0);
  return {
    totalPay,
    deductMinutes: extra.deductMinutes,
    overtimeCount: overtimeItems.length,
    overtimeMinutes: overtimeItems.reduce((s, it) => s + it.overtimeMinutes, 0),
  };
}
