// GET 일별 급여 상세(AC-18 데이터). amount = 급여인정시간 × 시급 검산.
import { NextResponse } from "next/server";
import { getRecord } from "@/lib/store";
import { calcPaidMinutes, calcDailyPay } from "@/lib/pay";
import { HOURLY_WAGE, DEFAULT_BREAK_RANGE } from "@/lib/constants";
import type { PayDetail } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ date: string }> },
): Promise<Response> {
  const { date } = await ctx.params;
  const record = getRecord(date);
  if (!record) {
    return NextResponse.json(
      { error: "해당 날짜 레코드가 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }

  const paidMinutes = calcPaidMinutes({
    workMinutes: record.workMinutes,
    deductMinutes: record.deductMinutes,
    status: record.status,
  });

  const detail: PayDetail = {
    date: record.date,
    clockIn: record.clockIn,
    clockOut: record.clockOut,
    hourlyWage: HOURLY_WAGE,
    paidMinutes,
    breakMinutes: record.breakMinutes,
    breakRange: record.breakMinutes > 0 ? DEFAULT_BREAK_RANGE : null,
    deductMinutes: record.deductMinutes,
    overtimeMinutes: record.overtimeMinutes,
    amount: calcDailyPay({
      paidMinutes,
      hourlyWage: HOURLY_WAGE,
      status: record.status,
    }),
  };

  return NextResponse.json(detail, { headers: NO_STORE });
}
