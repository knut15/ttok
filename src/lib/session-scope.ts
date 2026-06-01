// 세션→scope 브리지(키스톤). Auth.js 세션을 우선 진실원으로 쓰고,
// 세션이 없으면 기존 헤더 기반 readScope 로 폴백 → 기존 200+ 테스트 무회귀.
// 세션의 operationalId 가 인메모리 store 의 crewId 공간으로의 매핑(데모 매장).
import type { Session } from "next-auth"; // type-only(런타임 import 없음 → 테스트 안전)
import { readScope, type Scope } from "@/lib/scope";

export interface SessionScope extends Scope {
  userId?: string;
  storeId?: string;
  membershipId?: string;
  isManager: boolean;
}

/**
 * 현재 요청의 scope 결정.
 * - 로그인 세션(+멤버십 role) 있으면 세션 기반: crewId=operationalId ?? userId.
 * - 없으면(테스트·미인증) readScope(req) 폴백(헤더 또는 기본 김민정/crew) — 동작 동일.
 * auth() 가 요청 컨텍스트 밖(테스트)에서 throw/reject 해도 폴백으로 흡수.
 */
export async function resolveScope(req: Request): Promise<SessionScope> {
  // auth 는 동적 import — next-auth 정적 import 체인이 라우트로 번지지 않게 한다
  // (테스트 환경의 ESM 해석 회피). 실패하면(요청컨텍스트 밖·import 오류) 폴백.
  let session: Session | null = null;
  try {
    const { auth } = await import("@/auth");
    session = await auth();
  } catch {
    session = null;
  }

  if (session?.user?.id && session.role) {
    return {
      crewId: session.operationalId ?? session.user.id,
      role: session.role,
      userId: session.user.id,
      storeId: session.storeId ?? undefined,
      membershipId: session.membershipId ?? undefined,
      isManager: session.isManager ?? false,
    };
  }

  const s: Scope = readScope(req);
  return { ...s, isManager: false };
}
