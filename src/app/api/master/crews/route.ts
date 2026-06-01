// GET /api/master/crews?month=YYYY-MM → 200 MasterSummaryResponse (T8-5, AC-10/AC-11).
// 마스터 전용: role≠master → 403 (AC-12). client 는 route 경유로만 store 접근.
import { NextResponse } from "next/server";
import { getCrewSummaries } from "@/lib/store";
import { getStoreCrewSummaries } from "@/lib/master-summary";
import { resolveScope } from "@/lib/session-scope";
import { SEED_MONTH } from "@/lib/constants";
import type { MasterSummaryResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const scope = await resolveScope(request);
  // 마스터 게이트(AC-12). 멤버/헤더 부재 → 403.
  if (scope.role !== "master") {
    return NextResponse.json(
      { error: "집계 조회 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }

  const month = new URL(request.url).searchParams.get("month") ?? SEED_MONTH;
  // 세션(매장) 있으면 Prisma 멤버십 기반(합류 멤버 포함), 없으면 레거시 인메모리(테스트).
  const crews = scope.storeId
    ? await getStoreCrewSummaries(scope.storeId, month)
    : getCrewSummaries(month);
  const payload: MasterSummaryResponse = { month, crews };
  return NextResponse.json(payload, { headers: NO_STORE });
}
