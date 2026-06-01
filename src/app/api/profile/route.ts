// GET 프로필+매장 / PATCH 휴대폰·이메일만 반영. architect §2.3.
// 검증 우선순위: 형식(400) → 화이트리스트(name/birthDate 무시) → 머지(200).
import { NextResponse } from "next/server";
import { getProfile, updateProfile } from "@/lib/store";
import { isValidEmail, isValidPhone } from "@/features/mypage/domain";
import { enforceReadScope } from "@/lib/scope";
import { resolveScope, type SessionScope } from "@/lib/session-scope";
import type { ProfilePatch } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

/** 세션/헤더 scope + 본인 강제(멤버)/마스터 target(?crewId) 한 crewId. */
async function resolve(request: Request): Promise<{ scope: SessionScope; crewId: string }> {
  const scope = await resolveScope(request);
  const crewId = enforceReadScope(
    scope,
    new URL(request.url).searchParams.get("crewId") ?? undefined,
  );
  return { scope, crewId };
}

/** 매니저 표기: 본인(crew) 조회면 세션 isManager(Prisma 진실원) 우선, 아니면 store 값. */
function managerOf(scope: SessionScope, fallback: boolean): boolean {
  return scope.role === "crew" ? scope.isManager || fallback : fallback;
}

// GET /api/profile → 200 { profile, store, isManager }. 헤더 없으면(기존 테스트) 김민정 fallback.
export async function GET(request?: Request): Promise<Response> {
  if (!request) return NextResponse.json(getProfile(), { headers: NO_STORE });
  const { scope, crewId } = await resolve(request);
  const res = getProfile(crewId);
  return NextResponse.json(
    { ...res, isManager: managerOf(scope, res.isManager) },
    { headers: NO_STORE },
  );
}

// PATCH /api/profile  body: { phone?, email? } (AC-5/6/7/8)
export async function PATCH(request: Request): Promise<Response> {
  const { scope, crewId } = await resolve(request);
  const body = (await request.json()) as Record<string, unknown>;

  // 1) 형식 검증 — 전달된 phone/email만 검사 (AC-8, 머지보다 선행)
  if (typeof body.phone === "string" && !isValidPhone(body.phone)) {
    return NextResponse.json(
      { error: "휴대폰 형식이 올바르지 않습니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (typeof body.email === "string" && !isValidEmail(body.email)) {
    return NextResponse.json(
      { error: "이메일 형식이 올바르지 않습니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  // 2) 허용 필드만 추출 (name/birthDate는 여기서 탈락 — 200+무시)
  const patch: ProfilePatch = {};
  if (typeof body.phone === "string") patch.phone = body.phone;
  if (typeof body.email === "string") patch.email = body.email;

  // 3) 머지 후 200 + 갱신 profile 반환 (AC-5/6/7)
  const updated = updateProfile(patch, crewId);
  const { store, isManager } = getProfile(crewId);
  return NextResponse.json(
    { profile: updated, store, isManager: managerOf(scope, isManager) },
    { headers: NO_STORE },
  );
}
