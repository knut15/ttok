// 서버 가드(server-only) — 보호 페이지/온보딩 진입 통제. App Router 서버 컴포넌트에서 호출.
// Next 16(proxy.ts)에서는 Auth.js authorized 콜백이 발화하지 않으므로 서버 가드를 진실원으로 둔다.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserWithActiveMembership } from "@/lib/identity-repo";

/** 로그인 세션의 user 반환(없으면 null). */
export async function getSessionUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/**
 * 보호 페이지 진입 가드: 미로그인 → /login, 로그인했으나 멤버십 없음 → /onboarding.
 * 멤버십은 DB 직접 조회(토큰 갱신 지연과 무관하게 즉시 반영 — 온보딩 직후 안전).
 */
export async function requireMembership() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // 유령/만료 세션(쿠키는 있으나 DB에 user 없음) → 재로그인 유도(자가 치유).
  const result = await getUserWithActiveMembership(session.user.id);
  if (!result) redirect("/login");
  if (!result.membership) redirect("/onboarding");
  return { userId: result.userId, membership: result.membership };
}
