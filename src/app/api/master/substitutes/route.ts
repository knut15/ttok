// GET /api/master/substitutes → 200 MasterSubstitutesResponse (대타 승인 대기 목록).
// 마스터 전용: role≠master → 403. listPendingSubstitutes ⨝ listCrews(crewId→name).
import { NextResponse } from "next/server";
import { listPendingSubstitutes, listCrews } from "@/lib/store";
import { readScope } from "@/lib/scope";
import type { MasterSubstituteRow, MasterSubstitutesResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  if (readScope(request).role !== "master") {
    return NextResponse.json(
      { error: "대타 승인 조회 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  const nameById = new Map(listCrews().map((c) => [c.id, c.name]));
  const substitutes: MasterSubstituteRow[] = listPendingSubstitutes().map((e) => ({
    ...e,
    crewName: nameById.get(e.crewId) ?? e.crewId,
  }));
  const payload: MasterSubstitutesResponse = { substitutes };
  return NextResponse.json(payload, { headers: NO_STORE });
}
