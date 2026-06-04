"use client";

// 현재 사용자 훅 — 이제 Auth.js 세션(useSession)이 진실원(기존 localStorage mock 대체).
// 반환 형태(User)·import 경로는 유지 → 소비처(헤더/뷰) 무수정.
// authHeaders 는 그대로 유지: 세션이 있으면 서버 resolveScope 가 무시(무해), 비세션 폴백 호환.
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

export function useCurrentUser() {
  const { data } = useSession();
  if (!data?.user?.id) {
    return { user: INITIAL_USER, setCurrentUser: () => {} };
  }
  const role: Role = data.role ?? "crew";
  const name = data.user.name ?? "사용자";
  const crewId = data.operationalId ?? data.user.id;
  const user: User = {
    id: data.user.id,
    name,
    role,
    avatarInitial: name.charAt(0) || "?",
    crewId: role === "crew" ? crewId : undefined,
    isManager: data.isManager ?? false,
  };
  // setCurrentUser 는 세션 모델에서 의미 없음(전환=재로그인) — 호환용 no-op.
  return { user, setCurrentUser: () => {} };
}

/** fetch 헤더 scope 전달 → { x-crew-id, x-role }. 세션 존재 시 서버에서 무시됨(폴백 호환). */
export function authHeaders(user: User): Record<string, string> {
  return {
    [HEADER_CREW_ID]: user.crewId ?? user.id,
    [HEADER_ROLE]: user.role,
  };
}
