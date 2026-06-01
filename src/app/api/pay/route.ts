// GET 월간 급여(AC-10): {summary, items}. totalPay === Σ items.amount 불변식.
import { NextResponse } from "next/server";
import { getMonthRecords } from "@/lib/store";
import { buildPayItems } from "@/lib/seed";
import { buildPaySummary } from "@/lib/pay";
import { enforceReadScope } from "@/lib/scope";
import { resolveScope } from "@/lib/session-scope";
import type { PayResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? "";
  // T8-4: 본인 강제(멤버) / 마스터 target.
  const scoped = enforceReadScope(
    (await resolveScope(request)),
    url.searchParams.get("crewId") ?? undefined,
  );
  const records = await getMonthRecords(month, scoped);
  const items = buildPayItems(records);
  const deductMinutes = records.reduce((s, r) => s + r.deductMinutes, 0);
  const summary = buildPaySummary(items, { deductMinutes });

  // 리스트 표시 순서: 날짜 내림차순(최신 위). 주휴행은 해당 근무일 바로 아래.
  const sorted = [...items].sort((a, b) => {
    if (a.date === b.date) {
      // 같은 날: 근무행 먼저, 주휴행 나중
      return Number(a.isWeeklyHoliday) - Number(b.isWeeklyHoliday);
    }
    return b.date.localeCompare(a.date);
  });

  const payload: PayResponse = { summary, items: sorted };
  return NextResponse.json(payload, { headers: NO_STORE });
}
