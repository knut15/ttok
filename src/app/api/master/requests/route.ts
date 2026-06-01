// GET /api/master/requests → 200 MasterRequestsResponse (FR-2, AC-5/AC-6).
// 마스터 전용: role≠master → 403 (AC-8, api/master/crews 게이트 복제).
// listRequests()(전체) ⨝ listCrews()(crewId→name Map) 서버 조인 → crewName(폴백 crewId).
import { NextResponse } from "next/server";
import { listRequests, listCrews } from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";
import { DEFAULT_CREW_ID } from "@/lib/constants";
import type { MasterRequestRow, MasterRequestsResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  // 마스터 게이트(AC-8). 멤버/헤더 부재 → 403, store 불변.
  if ((await resolveScope(request)).role !== "master") {
    return NextResponse.json(
      { error: "수정요청 조회 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }

  // crewId→name 매핑(O(C)). 조인은 O(R) → 전체 O(R log R + C).
  const nameById = new Map(listCrews().map((c) => [c.id, c.name]));
  const requests: MasterRequestRow[] = listRequests().map((req) => {
    const crewId = req.crewId ?? DEFAULT_CREW_ID;
    return { ...req, crewName: nameById.get(crewId) ?? crewId };
  });

  const payload: MasterRequestsResponse = { requests };
  return NextResponse.json(payload, { headers: NO_STORE });
}
