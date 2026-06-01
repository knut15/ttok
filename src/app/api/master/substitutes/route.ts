// GET /api/master/substitutes → 200 MasterSubstitutesResponse (대타 승인 대기 목록).
// 마스터 전용: role≠master → 403. listPendingSubstitutes ⨝ listCrews(crewId→name).
import { NextResponse } from "next/server";
import { listPendingSubstitutes, listCrews } from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";
import { getStoreCrewIds } from "@/lib/identity-repo";
import type { MasterSubstituteRow, MasterSubstitutesResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const scope = await resolveScope(request);
  if (scope.role !== "master") {
    return NextResponse.json(
      { error: "대타 승인 조회 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  let pending = listPendingSubstitutes();
  // 매장 스코프(세션): 자기 매장 멤버만 — 실매장은 데모 시드 미노출.
  if (scope.storeId) {
    const ids = new Set(await getStoreCrewIds(scope.storeId));
    pending = pending.filter((e) => ids.has(e.crewId));
  }
  const nameById = new Map(listCrews().map((c) => [c.id, c.name]));
  const substitutes: MasterSubstituteRow[] = pending.map((e) => ({
    ...e,
    crewName: nameById.get(e.crewId) ?? e.crewId,
  }));
  const payload: MasterSubstitutesResponse = { substitutes };
  return NextResponse.json(payload, { headers: NO_STORE });
}
