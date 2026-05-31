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
