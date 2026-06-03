import { describe, expect, it } from "vitest";
import {
  buildPayslip,
  buildWeeklyHolidayRows,
  calcIncentive,
  calcInsurance,
  calcLocalIncomeTax,
  floor10,
} from "./payslip";
import { HOURLY_WAGE } from "./constants";
import type { AttendanceRecord } from "@/types";

// PDF(test.pdf) 검산값 — 김민정 2026-05. 총지급액 2,032,826 / 실지급 1,812,806.
const PDF_GROSS = 2_032_826;
const PDF_INCOME_TAX = 20_490;
const PDF_SALES = 16_112_200;

function rec(p: Partial<AttendanceRecord> & { date: string }): AttendanceRecord {
  return {
    status: "정상",
    clockIn: "08:00",
    clockOut: "15:00",
    breakMinutes: 30,
    workMinutes: 390,
    overtimeMinutes: 0,
    deductMinutes: 0,
    ...p,
  };
}

describe("floor10", () => {
  it("10원 미만 절사", () => {
    expect(floor10(96_520)).toBe(96_520);
    expect(floor10(9_602.7)).toBe(9_600);
    expect(floor10(18_295.43)).toBe(18_290);
  });
});

describe("calcInsurance — PDF 총지급액 기준", () => {
  const ins = calcInsurance(PDF_GROSS);
  it("국민연금 = 기준소득월액(1,000원 절사) × 4.75%", () => {
    expect(ins.nationalPension).toBe(96_520); // 2,032,000 × 0.0475
  });
  it("건강보험 = 총지급액 × 3.595%", () => {
    expect(ins.health).toBe(73_080);
  });
  it("장기요양 = 건강보험 × 13.14%", () => {
    expect(ins.longTermCare).toBe(9_600);
  });
  it("고용보험 = 총지급액 × 0.9%", () => {
    expect(ins.employment).toBe(18_290);
  });
  it("4대보험 합계 = 197,490", () => {
    expect(ins.nationalPension + ins.health + ins.longTermCare + ins.employment).toBe(197_490);
  });
});

describe("소득세·인센티브", () => {
  it("지방소득세 = 소득세 × 10% (10원 절사)", () => {
    expect(calcLocalIncomeTax(PDF_INCOME_TAX)).toBe(2_040); // 2,049 → 2,040
  });
  it("소득세 합계 = 22,530", () => {
    expect(PDF_INCOME_TAX + calcLocalIncomeTax(PDF_INCOME_TAX)).toBe(22_530);
  });
  it("인센티브 = 총매출 × 1%", () => {
    expect(calcIncentive(PDF_SALES)).toBe(161_122);
  });
});

describe("PDF 실지급액 검산", () => {
  it("총공제 220,020 / 실지급 1,812,806", () => {
    const ins = calcInsurance(PDF_GROSS);
    const insuranceTotal = ins.nationalPension + ins.health + ins.longTermCare + ins.employment;
    const taxTotal = PDF_INCOME_TAX + calcLocalIncomeTax(PDF_INCOME_TAX);
    const totalDeduction = insuranceTotal + taxTotal;
    expect(totalDeduction).toBe(220_020);
    expect(PDF_GROSS - totalDeduction).toBe(1_812_806);
  });
});

describe("buildWeeklyHolidayRows", () => {
  it("주별 라벨(월~일)·월 경계 주 포함", () => {
    // 2026-04-27(월)~04-29: 19.5h(≥15h) → 주휴 발생, 라벨 '04.27 ~ 05.03'
    const rows = buildWeeklyHolidayRows(
      [rec({ date: "2026-04-27" }), rec({ date: "2026-04-28" }), rec({ date: "2026-04-29" })],
      HOURLY_WAGE,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("04.27 ~ 05.03");
    expect(rows[0].amount).toBe(40_248); // (1170/60/40*8)h × 10320 = 5.2h... → 3.9h×10320
  });
  it("주 15시간 미만은 제외", () => {
    const rows = buildWeeklyHolidayRows([rec({ date: "2026-05-04" })], HOURLY_WAGE); // 6.5h
    expect(rows).toHaveLength(0);
  });
});

describe("buildPayslip — 불변식", () => {
  const records = [
    rec({ date: "2026-05-04", workMinutes: 390 }),
    rec({ date: "2026-05-05", workMinutes: 390 }),
    rec({ date: "2026-05-06", workMinutes: 480, overtimeMinutes: 90 }),
    rec({ date: "2026-05-29", status: "휴가", clockIn: null, clockOut: null, workMinutes: 0 }),
  ];
  const slip = buildPayslip({
    records,
    hourlyWage: HOURLY_WAGE,
    employee: { name: "김민정", birthDate: "1986-04-06", company: "매머드커피" },
    inputs: { incentiveEnabled: true, monthlySales: PDF_SALES, incomeTax: PDF_INCOME_TAX, nightPay: 0 },
    month: "2026-05",
    periodLabel: "2026.05.01 ~ 2026.05.31",
    payDate: "2026-06-03",
  });

  it("기본급 = 시급 × Σ근무분(차감 미반영)", () => {
    const base = slip.earnings.find((e) => e.label === "기본급");
    expect(base?.amount).toBe(Math.round((HOURLY_WAGE / 60) * (390 + 390 + 480)));
  });
  it("인센티브 = 총매출 × 1%", () => {
    expect(slip.earnings.find((e) => e.label === "1% 인센티브")?.amount).toBe(161_122);
  });
  it("총지급액 = 지급항목 합", () => {
    expect(slip.totalEarnings).toBe(slip.earnings.reduce((s, e) => s + e.amount, 0));
  });
  it("4대보험 합계행 = 하위 subRows 합, 총지급액 기준", () => {
    const four = slip.deductions.find((d) => d.label === "4대보험")!;
    expect(four.amount).toBe(four.subRows!.reduce((s, r) => s + r.amount, 0));
    const ins = calcInsurance(slip.totalEarnings);
    expect(four.amount).toBe(
      ins.nationalPension + ins.health + ins.longTermCare + ins.employment,
    );
  });
  it("실지급액 = 총지급 − 총공제", () => {
    expect(slip.netPay).toBe(slip.totalEarnings - slip.totalDeduction);
  });

  it("인센티브 미선택(incentiveEnabled=false) 시 항목 제외", () => {
    const noIncentive = buildPayslip({
      records,
      hourlyWage: HOURLY_WAGE,
      employee: { name: "김민정", birthDate: "1986-04-06", company: "매머드커피" },
      inputs: { incentiveEnabled: false, monthlySales: PDF_SALES, incomeTax: PDF_INCOME_TAX, nightPay: 0 },
      month: "2026-05",
      periodLabel: "2026.05.01 ~ 2026.05.31",
      payDate: "2026-06-03",
    });
    expect(noIncentive.earnings.find((e) => e.label === "1% 인센티브")).toBeUndefined();
    // 인센티브 제외분만큼 총지급액 감소.
    expect(slip.totalEarnings - noIncentive.totalEarnings).toBe(161_122);
  });
});
