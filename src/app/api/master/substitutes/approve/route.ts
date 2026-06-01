// POST /api/master/substitutes/approve { id } → 대타 승인(approval="수락").
// 마스터 전용: role≠master → 403. 없는 id → 404.
import { NextResponse } from "next/server";
import { approveSubstitute } from "@/lib/store";
import { resolveScope } from "@/lib/session-scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  if ((await resolveScope(request)).role !== "master") {
    return NextResponse.json(
      { error: "대타 승인 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string") {
    return NextResponse.json({ error: "id 가 필요합니다." }, { status: 400, headers: NO_STORE });
  }
  const entry = await approveSubstitute(body.id);
  if (!entry) {
    return NextResponse.json(
      { error: "대상 대타를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json(entry, { headers: NO_STORE });
}
