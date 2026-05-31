// GET 단일일 상세(AC-7). 없으면 404 일관 반환(architect §2.3, 엣지#5).
import { NextResponse } from "next/server";
import { getRecord } from "@/lib/store";
import { readScope, enforceReadScope } from "@/lib/scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  ctx: { params: Promise<{ date: string }> },
): Promise<Response> {
  const { date } = await ctx.params;
  // T8-4: 본인 강제(크루) / 마스터 target(?crewId).
  const scoped = enforceReadScope(
    readScope(request),
    new URL(request.url).searchParams.get("crewId") ?? undefined,
  );
  const record = getRecord(date, scoped);
  if (!record) {
    return NextResponse.json(
      { error: "해당 날짜 레코드가 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json(record, { headers: NO_STORE });
}
