// GET 월간 급여(AC-10): {summary, items}. totalPay === Σ items.amount 불변식.
import { NextResponse } from "next/server";
import { getMonthRecords } from "@/lib/attendance-store";
import { getPayslipInput } from "@/lib/payslip-input-store";
import { buildPayItems } from "@/lib/seed";
import { buildPaySummary, buildMonthStats } from "@/lib/pay";
import { enforceReadScope } from "@/lib/scope";
import { resolveScope } from "@/lib/session-scope";
import { hourlyWageForCrew } from "@/lib/identity-repo";
import { HOURLY_WAGE } from "@/lib/constants";
import type { PayResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  // T8-4: 본인 강제(멤버) / 마스터 target.
  const scope = await resolveScope(request);
  const scoped = enforceReadScope(scope, url.searchParams.get("crewId") ?? undefined);
  const records = await getMonthRecords(month, scoped);
  const hourlyWage = (await hourlyWageForCrew(scoped)) ?? HOURLY_WAGE;
  const items = buildPayItems(records, hourlyWage);
  const deductMinutes = records.reduce((s, r) => s + r.deductMinutes, 0);
  const summary = buildPaySummary(items, { deductMinutes });
  const stats = buildMonthStats(records, items, hourlyWage);

  // 리스트 표시 순서: 날짜 내림차순(최신 위). 주휴행은 해당 근무일 바로 아래.
  const sorted = [...items].sort((a, b) => {
    if (a.date === b.date) {
      // 같은 날: 근무행 먼저, 주휴행 나중
      return Number(a.isWeeklyHoliday) - Number(b.isWeeklyHoliday);
    }
    return b.date.localeCompare(a.date);
  });

  // 명세서 근무내역용 원본 레코드(날짜 오름차순). items/summary/stats 는 불변.
  const recordsAsc = [...records].sort((a, b) => a.date.localeCompare(b.date));

  // 명세서 입력값(저장값, 없으면 기본) + 편집 권한(마스터). 멤버는 statementInputs 로 완성본 조회.
  const statementInputs = await getPayslipInput(scoped, month);
  const canEditStatement = scope.role === "master";

  const payload: PayResponse = {
    summary,
    items: sorted,
    stats,
    records: recordsAsc,
    statementInputs,
    canEditStatement,
  };
  return NextResponse.json(payload, { headers: NO_STORE });
}
