// 급여명세서(월별) 계산 — 순수 함수(부수효과 0, store 비의존). PDF 스펙 검산 일치.
// 도출 불가 항목(총매출→인센티브, 근로소득세, 야간수당)은 PayslipInputs 로 외부 주입.

import type { AttendanceRecord, Payslip, PayslipInputs, PayslipLine } from "@/types";
import {
  INCENTIVE_RATE,
  INSURANCE_RATES,
  LOCAL_INCOME_TAX_RATE,
  OVERTIME_HOURLY_WAGE,
  PENSION_BASE_UNIT,
} from "./constants";
import { calcWeeklyHolidayPay } from "./pay";
import { shiftDay, weekStartMonday } from "./date";

/** 원 단위 절사(10원 미만 버림). 4대보험·지방소득세 공통 라운딩. */
export function floor10(n: number): number {
  return Math.floor(n / 10) * 10;
}

/** 분 → "N시간 M분" (lib 은 features 를 의존하지 않으므로 로컬 포맷터). */
function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/** "1234" → "1,234원". */
function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** "YYYY-MM-DD" → "MM.DD". */
function md(date: string): string {
  const [, m, d] = date.split("-");
  return `${m}.${d}`;
}

/**
 * 4대보험(근로자 부담분). gross=총지급액 기준.
 * - 국민연금: 기준소득월액(1,000원 절사) × 4.75%, 10원 절사.
 * - 건강/고용: 총지급액 × 요율, 10원 절사. 장기요양: 건강보험료 × 13.14%, 10원 절사.
 */
export function calcInsurance(gross: number): {
  nationalPension: number;
  health: number;
  longTermCare: number;
  employment: number;
} {
  const pensionBase = Math.floor(gross / PENSION_BASE_UNIT) * PENSION_BASE_UNIT;
  const nationalPension = floor10(pensionBase * INSURANCE_RATES.nationalPension);
  const health = floor10(gross * INSURANCE_RATES.health);
  const longTermCare = floor10(health * INSURANCE_RATES.longTermCare);
  const employment = floor10(gross * INSURANCE_RATES.employment);
  return { nationalPension, health, longTermCare, employment };
}

/** 지방소득세 = 근로소득세 × 10%, 10원 절사. */
export function calcLocalIncomeTax(incomeTax: number): number {
  return floor10(incomeTax * LOCAL_INCOME_TAX_RATE);
}

/** 인센티브 = 총매출 × 1%, 반올림. */
export function calcIncentive(monthlySales: number): number {
  return Math.round(monthlySales * INCENTIVE_RATE);
}

/**
 * 주휴수당 주별 세부행. 주(월~일) 단위 그룹(weekStartMonday) → 주휴액(calcWeeklyHolidayPay).
 * 라벨 "MM.DD ~ MM.DD"(월~일, 월 경계 주 포함). 주휴 미발생(<15h) 주는 제외. 주 시작 오름차순.
 */
export function buildWeeklyHolidayRows(
  records: AttendanceRecord[],
  hourlyWage: number,
): PayslipLine[] {
  const weekly = new Map<string, number>();
  for (const r of records) {
    if (r.status === "휴가" || r.workMinutes <= 0) continue;
    const key = weekStartMonday(r.date);
    weekly.set(key, (weekly.get(key) ?? 0) + r.workMinutes);
  }
  return [...weekly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weeklyWorkMinutes]) => ({
      weekStart,
      amount: calcWeeklyHolidayPay({ weeklyWorkMinutes, hourlyWage }),
    }))
    .filter((w) => w.amount > 0)
    .map((w) => ({
      label: `${md(w.weekStart)} ~ ${md(shiftDay(w.weekStart, 6))}`,
      amount: w.amount,
    }));
}

/**
 * 월별 급여명세서 산출. records=해당 월 근태(오름차순 무관), inputs=외부 입력값.
 * 기본급은 PDF 스펙대로 시급 × Σ근무분(차감 미반영). 총지급액 기준으로 4대보험 산정.
 */
export function buildPayslip(p: {
  records: AttendanceRecord[];
  hourlyWage: number;
  employee: { name: string; birthDate: string; company: string };
  inputs: PayslipInputs;
  month: string;
  periodLabel: string;
  payDate: string;
}): Payslip {
  const { records, hourlyWage, employee, inputs, month, periodLabel, payDate } = p;
  const perMinute = hourlyWage / 60;

  const totalWorkMinutes = records.reduce((s, r) => s + r.workMinutes, 0);
  const totalOvertime = records.reduce((s, r) => s + r.overtimeMinutes, 0);

  const basePay = Math.round(perMinute * totalWorkMinutes);
  const weeklyHolidayRows = buildWeeklyHolidayRows(records, hourlyWage);
  const weeklyHolidayPay = weeklyHolidayRows.reduce((s, r) => s + r.amount, 0);
  const overtimePay = Math.round((OVERTIME_HOURLY_WAGE / 60) * totalOvertime);
  const nightPay = Math.max(0, Math.round(inputs.nightPay));

  const earnings: PayslipLine[] = [
    { label: "기본급", amount: basePay, note: `${won(hourlyWage)} × ${hm(totalWorkMinutes)}` },
    { label: "주휴수당", amount: weeklyHolidayPay, subRows: weeklyHolidayRows },
    { label: "연장수당", amount: overtimePay, note: `${won(OVERTIME_HOURLY_WAGE)} × ${hm(totalOvertime)}` },
    { label: "야간수당", amount: nightPay },
  ];
  // 인센티브는 선택값 — 체크 시에만 항목 추가(총매출 × 1%).
  if (inputs.incentiveEnabled) {
    earnings.push({ label: "1% 인센티브", amount: calcIncentive(inputs.monthlySales) });
  }
  const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);

  const ins = calcInsurance(totalEarnings);
  const incomeTax = Math.max(0, Math.round(inputs.incomeTax));
  const localIncomeTax = calcLocalIncomeTax(incomeTax);

  const insuranceRows: PayslipLine[] = [
    { label: "국민연금", amount: ins.nationalPension, note: "4.75%" },
    { label: "건강보험", amount: ins.health, note: "3.595%" },
    { label: "장기요양보험", amount: ins.longTermCare, note: "건강보험 × 13.14%" },
    { label: "고용보험", amount: ins.employment, note: "0.9%" },
  ];
  const taxRows: PayslipLine[] = [
    { label: "근로소득세", amount: incomeTax },
    { label: "지방소득세", amount: localIncomeTax, note: "소득세 × 10%" },
  ];
  const deductions: PayslipLine[] = [
    {
      label: "4대보험",
      amount: insuranceRows.reduce((s, r) => s + r.amount, 0),
      subRows: insuranceRows,
    },
    { label: "소득세", amount: taxRows.reduce((s, r) => s + r.amount, 0), subRows: taxRows },
  ];
  const totalDeduction = deductions.reduce((s, d) => s + d.amount, 0);
  const netPay = totalEarnings - totalDeduction;

  return {
    month,
    periodLabel,
    payDate,
    employee,
    earnings,
    totalEarnings,
    deductions,
    totalDeduction,
    netPay,
  };
}
