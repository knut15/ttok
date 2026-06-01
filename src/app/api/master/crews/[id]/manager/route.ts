// PATCH /api/master/crews/[id]/manager → 200 { crew } (T16/T17).
// 마스터 전용: role≠master → 403. body { on: boolean } 로 매니저 지정/해제.
// 대상이 없거나 master 역할이면 404(crew 만 토글 가능). client 는 route 경유로만 store 접근.
import { NextResponse } from "next/server";
import { setManager } from "@/lib/store";
import { setMembershipManager } from "@/lib/identity-repo";
import { resolveScope } from "@/lib/session-scope";
import type { Crew } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const scope = await resolveScope(request);
  // 마스터 게이트. 멤버/헤더 부재 → 403.
  if (scope.role !== "master") {
    return NextResponse.json(
      { error: "매니저 지정 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { on?: unknown } | null;
  if (typeof body?.on !== "boolean") {
    return NextResponse.json(
      { error: "on(boolean) 이 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  // 세션(매장) 경로: Prisma 멤버십 isManager 갱신(진실원). 데모 매핑이면 인메모리도 동기화
  // (스케줄 작성권한 canWriteSchedule 일관). 레거시(테스트) 경로는 인메모리만.
  if (scope.storeId) {
    const membership = await setMembershipManager(scope.storeId, id, body.on);
    if (!membership) {
      return NextResponse.json(
        { error: "대상 멤버를 찾을 수 없습니다." },
        { status: 404, headers: NO_STORE },
      );
    }
    setManager(id, body.on); // 데모 crewId 면 인메모리 반영, 아니면 no-op
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  const crew: Crew | null = setManager(id, body.on);
  if (!crew) {
    return NextResponse.json(
      { error: "대상 멤버를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ crew }, { headers: NO_STORE });
}
