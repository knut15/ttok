// /api/invites — 마스터 전용 초대 관리(role≠master → 403).
// POST: 발급(만료 7일). GET: 매장 발급 이력. DELETE { code }: 회수.
// 세션(매장 storeId)이면 Prisma, 아니면(헤더 전용·레거시 테스트) 인메모리(POST만).
import { NextResponse } from "next/server";
import { createInvite } from "@/lib/store";
import {
  createInviteForStore,
  listStoreInvites,
  revokeInvite,
} from "@/lib/identity-repo";
import { resolveScope } from "@/lib/session-scope";

const NO_STORE = { "Cache-Control": "no-store" };

/** 마스터 게이트 통과 시 scope 반환, 아니면 403 Response. */
async function requireMaster(request: Request) {
  const scope = await resolveScope(request);
  if (scope.role !== "master") {
    return {
      scope: null,
      deny: NextResponse.json(
        { error: "초대 관리 권한이 없습니다." },
        { status: 403, headers: NO_STORE },
      ),
    };
  }
  return { scope, deny: null };
}

export async function POST(request: Request): Promise<Response> {
  const { scope, deny } = await requireMaster(request);
  if (deny) return deny;
  // 로그인 세션(매장 식별 가능) → Prisma 초대(만료 포함). 없으면 레거시 인메모리.
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

export async function GET(request: Request): Promise<Response> {
  const { scope, deny } = await requireMaster(request);
  if (deny) return deny;
  const invites = scope.storeId ? await listStoreInvites(scope.storeId) : [];
  return NextResponse.json({ invites }, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const { scope, deny } = await requireMaster(request);
  if (deny) return deny;
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "code 가 필요합니다." }, { status: 400, headers: NO_STORE });
  }
  if (!scope.storeId) {
    return NextResponse.json({ error: "매장 세션이 필요합니다." }, { status: 400, headers: NO_STORE });
  }
  const ok = await revokeInvite(scope.storeId, code);
  if (!ok) {
    return NextResponse.json(
      { error: "회수할 수 없는 코드입니다(이미 사용/회수 또는 없음)." },
      { status: 409, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
