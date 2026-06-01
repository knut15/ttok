// PATCH /api/master/crews/[id]/manager → 200 { crew } (T16/T17).
// 마스터 전용: role≠master → 403. body { on: boolean } 로 매니저 지정/해제.
// 대상이 없거나 master 역할이면 404(crew 만 토글 가능). client 는 route 경유로만 store 접근.
import { NextResponse } from "next/server";
import { setManager } from "@/lib/store";
import { readScope } from "@/lib/scope";
import type { Crew } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  // 마스터 게이트. 멤버/헤더 부재 → 403.
  if (readScope(request).role !== "master") {
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

  const crew: Crew | null = setManager(id, body.on);
  if (!crew) {
    return NextResponse.json(
      { error: "대상 멤버를 찾을 수 없습니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ crew }, { headers: NO_STORE });
}
