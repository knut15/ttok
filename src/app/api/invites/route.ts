// POST /api/invites → 201 Invite (T8-6, AC-13). 마스터 전용: role≠master → 403 (AC-15).
// client 는 route 경유로만 store 접근. createInvite 의 게이트는 여기(route) 책임.
import { NextResponse } from "next/server";
import { createInvite } from "@/lib/store";
import { readScope } from "@/lib/scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const scope = readScope(request);
  // 마스터 게이트(AC-15). role≠master → 403, store 불변.
  if (scope.role !== "master") {
    return NextResponse.json(
      { error: "초대 생성 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  const invite = createInvite(scope.crewId);
  return NextResponse.json(invite, { status: 201, headers: NO_STORE });
}
