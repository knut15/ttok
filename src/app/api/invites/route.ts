// POST /api/invites → 201 Invite. 마스터 전용: role≠master → 403.
// 세션(실/데모 매장, storeId 보유)이면 Prisma 초대 발급, 아니면(헤더 전용·레거시 테스트) 인메모리.
import { NextResponse } from "next/server";
import { createInvite } from "@/lib/store";
import { createInviteForStore } from "@/lib/identity-repo";
import { resolveScope } from "@/lib/session-scope";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const scope = await resolveScope(request);
  // 마스터 게이트. role≠master → 403, store 불변.
  if (scope.role !== "master") {
    return NextResponse.json(
      { error: "초대 생성 권한이 없습니다." },
      { status: 403, headers: NO_STORE },
    );
  }
  // 로그인 세션(매장 식별 가능) → Prisma 초대. 없으면 레거시 인메모리.
  if (scope.storeId) {
    const invite = await createInviteForStore({
      storeId: scope.storeId,
      createdBy: scope.membershipId ?? scope.userId ?? "master",
    });
    return NextResponse.json(invite, { status: 201, headers: NO_STORE });
  }
  const invite = createInvite(scope.crewId);
  return NextResponse.json(invite, { status: 201, headers: NO_STORE });
}
