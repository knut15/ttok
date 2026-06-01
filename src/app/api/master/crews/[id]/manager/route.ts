// PATCH /api/master/crews/[id]/manager → 200. 마스터 전용: role≠master → 403.
// body { on: boolean }. Prisma Membership.isManager 갱신(진실원). 대상 없으면 404.
import { NextResponse } from "next/server";
import { resolveScope } from "@/lib/session-scope";
import { resolveStoreId, setMembershipManager } from "@/lib/identity-repo";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const scope = await resolveScope(request);
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

  const storeId = await resolveStoreId(scope);
  const membership = storeId ? await setMembershipManager(storeId, id, body.on) : null;
  if (!membership) {
    return NextResponse.json(
      { error: "대상 멤버를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
