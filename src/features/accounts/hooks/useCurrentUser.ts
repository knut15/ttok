"use client";

// 현재 사용자 Context 소비 훅 + authHeaders() (architect §2.4).
import { useContext } from "react";
import {
  CurrentUserContext,
  INITIAL_USER,
} from "@/features/accounts/context/CurrentUserProvider";
import { HEADER_CREW_ID, HEADER_ROLE } from "@/lib/constants";
import type { User } from "@/types";

/** Provider 밖에서도 안전하게 김민정 기본값 반환(가드). */
export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    return { user: INITIAL_USER, setCurrentUser: () => {} };
  }
  return ctx;
}

/** fetch 헤더로 현재 사용자 scope 전달 → { x-crew-id, x-role }. crewId 우선 crewId ?? id. */
export function authHeaders(user: User): Record<string, string> {
  return {
    [HEADER_CREW_ID]: user.crewId ?? user.id,
    [HEADER_ROLE]: user.role,
  };
}
