// GET 단일일 상세(AC-7). T12(AC-2): 유효 날짜·기록 없음 → 200 + null(빈 상태).
//   잘못된 날짜 형식(2026-05-99 등)만 404 유지(엣지#5, 런타임 크래시 금지).
import { NextResponse } from "next/server";
import { getRecord } from "@/lib/store";
import { isValidDateString } from "@/lib/date";
import { enforceReadScope } from "@/lib/scope";
import { resolveScope } from "@/lib/session-scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  ctx: { params: Promise<{ date: string }> },
): Promise<Response> {
  const { date } = await ctx.params;
  // 잘못된 날짜 형식은 기존대로 404(엣지#5). 유효 형식은 기록 유무와 무관하게 200.
  if (!isValidDateString(date)) {
    return NextResponse.json(
      { error: "잘못된 날짜 형식입니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  // T8-4: 본인 강제(멤버) / 마스터 target(?crewId).
  const scoped = enforceReadScope(
    (await resolveScope(request)),
    new URL(request.url).searchParams.get("crewId") ?? undefined,
  );
  // AC-2(T12): 유효 날짜인데 기록 없음 → 200 + null(클라가 record 없음으로 처리).
  const record = getRecord(date, scoped);
  return NextResponse.json(record, { headers: NO_STORE });
}
