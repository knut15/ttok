"use client";

// 현재 사용자 훅 — 진실원은 next-auth 세션(useSession), 클라 전역 상태는 zustand store.
//   useCurrentUserSync: 세션을 구독해 파생 User 를 store 로 동기화(앱 루트에서 1회 마운트).
//   useCurrentUser: store 만 읽음 → 소비처는 세션을 직접 구독하지 않아 재렌더/중복 fetch 감소.
// 반환 형태(User)·import 경로는 유지 → 소비처(헤더/뷰) 무수정.
// authHeaders 는 그대로 유지: 세션이 있으면 서버 resolveScope 가 무시(무해), 비세션 폴백 호환.
import { useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { HEADER_CREW_ID, HEADER_ROLE } from "@/lib/constants";
import type { Role, User } from "@/types";
import { INITIAL_USER, useCurrentUserStore } from "@/features/accounts/stores/currentUserStore";

export { INITIAL_USER };

/**
 * 세션 → zustand store 동기화. 앱 루트(SessionProvider 내부)에서 1회만 마운트한다.
 * 세션 원시값이 바뀔 때만 새 User identity 를 만들어 store 에 반영(불필요한 재계산 방지).
 */
export function useCurrentUserSync(): void {
  const { data } = useSession();
  const setUser = useCurrentUserStore((s) => s.setUser);

  const id = data?.user?.id;
  const sessName = data?.user?.name ?? null;
  const sessRole = data?.role ?? null;
  const sessOpId = data?.operationalId ?? null;
  const sessIsManager = data?.isManager ?? false;

  const user = useMemo<User>(() => {
    if (!id) return INITIAL_USER;
    const role: Role = sessRole ?? "crew";
    const name = sessName ?? "사용자";
    const crewId = sessOpId ?? id;
    return {
      id,
      name,
      role,
      avatarInitial: name.charAt(0) || "?",
      crewId: role === "crew" ? crewId : undefined,
      isManager: sessIsManager,
    };
  }, [id, sessName, sessRole, sessOpId, sessIsManager]);

  useEffect(() => {
    setUser(user);
  }, [user, setUser]);
}

/** 현재 사용자(zustand store) 소비. setCurrentUser 는 store 액션(stable). */
export function useCurrentUser() {
  const user = useCurrentUserStore((s) => s.user);
  const setCurrentUser = useCurrentUserStore((s) => s.setUser);
  return useMemo(() => ({ user, setCurrentUser }), [user, setCurrentUser]);
}

/** fetch 헤더 scope 전달 → { x-crew-id, x-role }. 세션 존재 시 서버에서 무시됨(폴백 호환). */
export function authHeaders(user: User): Record<string, string> {
  return {
    [HEADER_CREW_ID]: user.crewId ?? user.id,
    [HEADER_ROLE]: user.role,
  };
}
