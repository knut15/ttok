// 급여/주휴/차감 계산 — 순수 함수 (부수효과 0, store 비의존). architect §3.1.

import type {
  AttendanceRecord,
  PayItem,
  PayMonthStats,
  PaySummary,
  StabilityAxis,
  WorkStatus,
} from "@/types";
import { REGULAR_MINUTES } from "./constants";

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

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clockIn(r: AttendanceRecord): string {
  return r.clockInStatus ?? (r.status === "결근" || r.status === "휴가" || r.status === "지각" ? r.status : "정상");
}
function clockOut(r: AttendanceRecord): string {
  return r.clockOutStatus ?? (r.status === "연장" ? "연장" : "정상");
}

/**
 * 월간 급여/근태 통계 + 근무 안정성 레이더(5축, 0~100).
 * records: 월 레코드, items: buildPayItems 결과(주휴 합 산출용), hourlyWage: 멤버 시급.
 */
export function buildMonthStats(
  records: AttendanceRecord[],
  items: PayItem[],
  hourlyWage: number,
): PayMonthStats {
  const isVac = (r: AttendanceRecord) => r.status === "휴가";
  const isAbsent = (r: AttendanceRecord) => clockIn(r) === "결근";

  const workRecs = records.filter((r) => !isVac(r) && !isAbsent(r) && r.workMinutes > 0);
  const workDays = workRecs.length;
  const workMinutes = workRecs.reduce((s, r) => s + r.workMinutes, 0);
  const breakMinutes = workRecs.reduce((s, r) => s + r.breakMinutes, 0);

  const lateCount = records.filter((r) => clockIn(r) === "지각").length;
  const earlyLeaveCount = records.filter((r) => clockOut(r) === "조퇴").length;
  const absentCount = records.filter(isAbsent).length;
  const vacationDays = records.filter(isVac).length;
  const overtimeRecs = records.filter((r) => r.overtimeMinutes > 0);
  const overtimeCount = overtimeRecs.length;
  const overtimeMinutes = overtimeRecs.reduce((s, r) => s + r.overtimeMinutes, 0);

  const weeklyHolidayPay = items
    .filter((it) => it.isWeeklyHoliday)
    .reduce((s, it) => s + it.amount, 0);
  const totalPay = items.reduce((s, it) => s + it.amount, 0);
  const basePay = totalPay - weeklyHolidayPay;

  // 근태 평가 분모: 휴가 제외 출근 예정일(결근 포함).
  const attDays = records.filter((r) => !isVac(r)).length;
  const ratio = (n: number) => (attDays > 0 ? (1 - n / attDays) * 100 : 100);
  const fulfill =
    workDays > 0 ? (workMinutes / (workDays * REGULAR_MINUTES)) * 100 : 0;
  const overtimeScore = (overtimeMinutes / 600) * 100; // 10시간(600분) → 100

  const stability: StabilityAxis[] = [
    { label: "출근", score: clamp100(ratio(absentCount)) },
    { label: "정시출근", score: clamp100(ratio(lateCount)) },
    { label: "정시퇴근", score: clamp100(ratio(earlyLeaveCount)) },
    { label: "근무시간", score: clamp100(fulfill) },
    { label: "연장기여", score: clamp100(overtimeScore) },
  ];

  return {
    hourlyWage,
    workDays,
    workMinutes,
    breakMinutes,
    weeklyHolidayPay,
    basePay,
    lateCount,
    earlyLeaveCount,
    absentCount,
    vacationDays,
    overtimeCount,
    overtimeMinutes,
    stability,
  };
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
