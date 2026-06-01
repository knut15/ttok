// GET /api/master/requests → 200 MasterRequestsResponse (FR-2, AC-5/AC-6).
// 마스터 전용: role≠master → 403 (AC-8, api/master/crews 게이트 복제).
// listRequests()(전체) ⨝ listCrews()(crewId→name Map) 서버 조인 → crewName(폴백 crewId).
import { NextResponse } from "next/server";
import { listRequests, listCrews } from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";
import { getStoreCrewIds } from "@/lib/identity-repo";
import { DEFAULT_CREW_ID } from "@/lib/constants";
import type { MasterRequestRow, MasterRequestsResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const scope = await resolveScope(request);
  // 마스터 게이트(AC-8). 멤버/헤더 부재 → 403, store 불변.
  if (scope.role !== "master") {
    return NextResponse.json(
      { error: "수정요청 조회 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }

  let all = listRequests();
  // 매장 스코프(세션): 자기 매장 멤버 요청만 — 실매장은 데모 시드 미노출.
  if (scope.storeId) {
    const ids = new Set(await getStoreCrewIds(scope.storeId));
    all = all.filter((r) => ids.has(r.crewId ?? DEFAULT_CREW_ID));
  }

  // crewId→name 매핑(O(C)). 조인은 O(R) → 전체 O(R log R + C).
  const nameById = new Map(listCrews().map((c) => [c.id, c.name]));
  const requests: MasterRequestRow[] = all.map((req) => {
    const crewId = req.crewId ?? DEFAULT_CREW_ID;
    return { ...req, crewName: nameById.get(crewId) ?? crewId };
  });

  const payload: MasterRequestsResponse = { requests };
  return NextResponse.json(payload, { headers: NO_STORE });
}
