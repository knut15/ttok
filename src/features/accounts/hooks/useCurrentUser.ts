"use client";

// 현재 사용자 훅 — 이제 Auth.js 세션(useSession)이 진실원(기존 localStorage mock 대체).
// 반환 형태(User)·import 경로는 유지 → 소비처(헤더/뷰) 무수정.
// authHeaders 는 그대로 유지: 세션이 있으면 서버 resolveScope 가 무시(무해), 비세션 폴백 호환.
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { HEADER_CREW_ID, HEADER_ROLE } from "@/lib/constants";
import type { Role, User } from "@/types";

/** 세션 로딩/비로그인 시 임시 폴백(가드 통과 후 (app) 에서는 실제로 노출되지 않음). */
export const INITIAL_USER: User = {
  id: "guest",
  name: "",
  role: "crew",
  avatarInitial: "",
  crewId: "guest",
  isManager: false,
};

// setCurrentUser 는 세션 모델에서 의미 없음(전환=재로그인) — 호환용 stable no-op.
const NOOP = () => {};

export function useCurrentUser() {
  const { data } = useSession();
  // perf: user 객체를 세션 원시값 기준으로 메모이즈 → 매 렌더 새 객체 방지.
  //   (이전엔 렌더마다 새 user → 모든 소비 훅의 useCallback/effect 가 재생성·재실행되어
  //    중복 fetch·reload 루프 유발.) 세션이 바뀔 때만 새 identity.
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

  return useMemo(() => ({ user, setCurrentUser: NOOP }), [user]);
}

/** fetch 헤더 scope 전달 → { x-crew-id, x-role }. 세션 존재 시 서버에서 무시됨(폴백 호환). */
export function authHeaders(user: User): Record<string, string> {
  return {
    [HEADER_CREW_ID]: user.crewId ?? user.id,
    [HEADER_ROLE]: user.role,
  };
}
