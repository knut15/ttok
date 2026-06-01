// POST /api/onboarding/store — 마스터 가입(사업자번호 + 매장명 → Store + master Membership).
// 로그인 필수. 이미 멤버십 보유 시 409. 사업자번호 검증(loc/dev=off 무조건 통과).
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/guard";
import { validateBizNumber } from "@/lib/biz-number";
import {
  createStoreWithMaster,
  findActiveMembership,
  userExists,
} from "@/lib/identity-repo";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers: NO_STORE });
  }
  // 유령/만료 세션 방어(예: DB 리셋) → FK 500 대신 재로그인 유도.
  if (!(await userExists(user.id))) {
    return NextResponse.json(
      { error: "세션이 만료되었습니다. 다시 로그인해 주세요." },
      { status: 401, headers: NO_STORE },
    );
  }
  if (await findActiveMembership(user.id)) {
    return NextResponse.json(
      { error: "이미 매장에 소속되어 있습니다." },
      { status: 409, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { storeName?: string; bizNumber?: string }
    | null;
  const storeName = body?.storeName?.trim() ?? "";
  const bizNumber = body?.bizNumber?.trim() ?? "";
  if (!storeName || !bizNumber) {
    return NextResponse.json(
      { error: "매장명과 사업자등록번호가 필요합니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!(await validateBizNumber(bizNumber))) {
    return NextResponse.json(
      { error: "유효하지 않은 사업자등록번호입니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const bizVerified = (process.env.BIZ_VALIDATION ?? "off") !== "off";
  const result = await createStoreWithMaster({
    userId: user.id,
    storeName,
    bizNumber,
    bizVerified,
  });
  if (result === "duplicate-biz") {
    return NextResponse.json(
      { error: "이미 등록된 사업자등록번호입니다." },
      { status: 409, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { ok: true, storeId: result.store.id, membershipId: result.membership.id },
    { status: 201, headers: NO_STORE },
  );
}
