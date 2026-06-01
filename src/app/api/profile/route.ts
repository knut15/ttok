// GET 프로필+매장 / PATCH 휴대폰·이메일만 반영. architect §2.3.
// 검증 우선순위: 형식(400) → 화이트리스트(name/birthDate 무시) → 머지(200).
import { NextResponse } from "next/server";
import { getProfile, updateProfile } from "@/lib/store";
import { isValidEmail, isValidPhone } from "@/features/mypage/domain";
import { readScope, enforceReadScope } from "@/lib/scope";
import type { ProfilePatch } from "@/types";

const NO_STORE = { "Cache-Control": "no-store" };

/** T8-4: 요청 헤더 scope → 본인 강제(크루)/마스터 target(?crewId). */
function scopeOf(request: Request): string {
  return enforceReadScope(
    readScope(request),
    new URL(request.url).searchParams.get("crewId") ?? undefined,
  );
}

// GET /api/profile → 200 { profile, store } (AC-4). 헤더 없으면(기존 테스트) 김민정 fallback.
export async function GET(request?: Request): Promise<Response> {
  if (!request) return NextResponse.json(getProfile(), { headers: NO_STORE });
  return NextResponse.json(getProfile(scopeOf(request)), { headers: NO_STORE });
}

// PATCH /api/profile  body: { phone?, email? } (AC-5/6/7/8)
export async function PATCH(request: Request): Promise<Response> {
  const scoped = scopeOf(request);
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
  const updated = updateProfile(patch, scoped);
  const { store, isManager } = getProfile(scoped);
  return NextResponse.json(
    { profile: updated, store, isManager },
    { headers: NO_STORE },
  );
}
