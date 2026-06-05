"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProfileResponse, ProfilePatch } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };
const PROFILE_PREFIX = "profile|";

/**
 * 프로필+매장 조회/수정 훅 (useMonthPay 패턴 답습).
 * 마운트/전환 시 GET. update()는 PATCH 후 응답으로 직접 setState(왕복 1회).
 * 400 응답은 throw → 호출자(ProfileForm)가 에러 메시지 처리(AC-14).
 * T8-4: authHeaders spread + crewId 를 effect 의존성에 추가(전환 시 무효화).
 * perf: 공유 캐시(dedup+TTL) — 마이페이지 재진입 즉시 표시, 사용자 전환 시에만 동기 리셋.
 */
export function useProfile(targetCrewId?: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const queryClient = useQueryClient();
  const scopeKey = `${crewId}|${targetCrewId ?? "self"}`;
  const query = useQuery({
    queryKey: [PROFILE_PREFIX, scopeKey],
    queryFn: async () => {
      const url = targetCrewId ? `/api/profile?crewId=${targetCrewId}` : "/api/profile";
      const res = await fetch(url, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok ? ((await res.json()) as ProfileResponse) : null;
    },
  });

  const update = useCallback(
    async (patch: ProfilePatch) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(user) },
        body: JSON.stringify(patch),
        cache: "no-store",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error ?? "저장에 실패했습니다.");
      }
      const json = (await res.json()) as ProfileResponse;
      queryClient.setQueryData([PROFILE_PREFIX, `${crewId}|self`], json);
      return json;
    },
    [user, crewId, queryClient],
  );

  return { data: query.data ?? null, loading: query.isLoading, update };
}
