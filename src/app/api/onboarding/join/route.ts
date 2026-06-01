// POST /api/onboarding/join — 초대코드로 멤버(크루) 합류. 로그인 필수.
// 없는 코드 400 / 사용된 코드 409 / 이미 그 매장 멤버 409. 성공 시 crew Membership 생성.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/guard";
import { joinByInviteCode, userExists } from "@/lib/identity-repo";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers: NO_STORE });
  }
  if (!(await userExists(user.id))) {
    return NextResponse.json(
      { error: "세션이 만료되었습니다. 다시 로그인해 주세요." },
      { status: 401, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "초대 코드가 필요합니다." }, { status: 400, headers: NO_STORE });
  }

  const result = await joinByInviteCode({ userId: user.id, code });
  if (result === "invalid") {
    return NextResponse.json(
      { error: "존재하지 않는 초대 코드입니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (result === "revoked") {
    return NextResponse.json(
      { error: "회수된 초대 코드입니다." },
      { status: 410, headers: NO_STORE },
    );
  }
  if (result === "expired") {
    return NextResponse.json(
      { error: "만료된 초대 코드입니다." },
      { status: 410, headers: NO_STORE },
    );
  }
  if (result === "used") {
    return NextResponse.json(
      { error: "이미 사용된 초대 코드입니다." },
      { status: 409, headers: NO_STORE },
    );
  }
  if (result === "already-member") {
    return NextResponse.json(
      { error: "이미 이 매장의 멤버입니다." },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { ok: true, storeId: result.storeId, membershipId: result.membership.id },
    { status: 201, headers: NO_STORE },
  );
}
