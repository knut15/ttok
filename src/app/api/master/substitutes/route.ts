// GET /api/master/substitutes → 200 MasterSubstitutesResponse (대타 승인 대기 목록).
// 마스터 전용: role≠master → 403. listPendingSubstitutes ⨝ listCrews(crewId→name).
import { NextResponse } from "next/server";
import { listPendingSubstitutes } from "@/lib/schedule-store";
import { resolveScope } from "@/lib/session-scope";
import { resolveStoreId, getStoreMembers } from "@/lib/identity-repo";
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
  const storeId = await resolveStoreId(scope);
  if (!storeId) {
    return NextResponse.json({ substitutes: [] }, { headers: NO_STORE });
  }
  const pending = await listPendingSubstitutes(storeId);
  // crewId → 이름(Prisma 멤버 조인).
  const nameById = new Map(
    (await getStoreMembers(storeId)).map((m) => [m.operationalId ?? m.id, m.user?.name ?? ""]),
  );
  const substitutes: MasterSubstituteRow[] = pending.map((e) => ({
    ...e,
    crewName: nameById.get(e.crewId) || e.crewId,
  }));
  const payload: MasterSubstitutesResponse = { substitutes };
  return NextResponse.json(payload, { headers: NO_STORE });
}
