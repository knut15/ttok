"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileResponse, ProfilePatch } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { cachedJSON, primeCache } from "@/lib/client-cache";

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
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const scopeKey = `${crewId}|${targetCrewId ?? "self"}`;
  const cacheKey = `${PROFILE_PREFIX}${scopeKey}`;
  const prevScope = useRef(scopeKey);

  useEffect(() => {
    let active = true;
    // E-3: 사용자 전환 시에만 즉시 리셋(타인 프로필 1프레임 노출 0).
    if (prevScope.current !== scopeKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      prevScope.current = scopeKey;
    }
    setLoading(true);
    // 마스터가 멤버 명세서 조회 시 ?crewId 타겟(멤버는 서버가 본인 강제).
    const url = targetCrewId ? `/api/profile?crewId=${targetCrewId}` : "/api/profile";
    cachedJSON<ProfileResponse>(cacheKey, url, {
      ...NO_STORE,
      headers: authHeaders(user),
    }).then((json) => {
      if (!active) return;
      setData(json);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, targetCrewId]);

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
      setData(json);
      // 본인 프로필 수정 → 본인 캐시 즉시 갱신(targetCrewId 없는 self key).
      primeCache(`${PROFILE_PREFIX}${crewId}|self`, json);
      return json;
    },
    [user, crewId],
  );

  return { data, loading, update };
}
