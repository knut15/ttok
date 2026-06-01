// /api/invites — 마스터 전용 초대 관리(role≠master → 403). Prisma.
// POST: 발급(만료 7일). GET: 매장 발급 이력. DELETE { code }: 회수.
import { NextResponse } from "next/server";
import {
  createInviteForStore,
  listStoreInvites,
  revokeInvite,
  resolveStoreId,
} from "@/lib/identity-repo";
import { resolveScope } from "@/lib/session-scope";

const NO_STORE = { "Cache-Control": "no-store" };

/** 마스터 게이트 통과 시 {scope, storeId}, 아니면 deny Response. */
async function requireMaster(request: Request) {
  const scope = await resolveScope(request);
  if (scope.role !== "master") {
    return {
      storeId: null,
      scope: null,
      deny: NextResponse.json(
        { error: "초대 관리 권한이 없습니다." },
        { status: 403, headers: NO_STORE },
      ),
    };
  }
  return { storeId: await resolveStoreId(scope), scope, deny: null };
}

export async function POST(request: Request): Promise<Response> {
  const { storeId, scope, deny } = await requireMaster(request);
  if (deny) return deny;
  if (!storeId) {
    return NextResponse.json({ error: "매장을 찾을 수 없습니다." }, { status: 400, headers: NO_STORE });
  }
  const invite = await createInviteForStore({
    storeId,
    createdBy: scope.membershipId ?? scope.userId ?? scope.crewId,
  });
  return NextResponse.json(invite, { status: 201, headers: NO_STORE });
}

export async function GET(request: Request): Promise<Response> {
  const { storeId, deny } = await requireMaster(request);
  if (deny) return deny;
  const invites = storeId ? await listStoreInvites(storeId) : [];
  return NextResponse.json({ invites }, { headers: NO_STORE });
}

export async function DELETE(request: Request): Promise<Response> {
  const { storeId, deny } = await requireMaster(request);
  if (deny) return deny;
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "code 가 필요합니다." }, { status: 400, headers: NO_STORE });
  }
  if (!storeId) {
    return NextResponse.json({ error: "매장 세션이 필요합니다." }, { status: 400, headers: NO_STORE });
  }
  const ok = await revokeInvite(storeId, code);
  if (!ok) {
    return NextResponse.json(
      { error: "회수할 수 없는 코드입니다(이미 사용/회수 또는 없음)." },
      { status: 409, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
