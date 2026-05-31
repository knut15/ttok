"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfileResponse, ProfilePatch } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

/**
 * 프로필+매장 조회/수정 훅 (useMonthPay 패턴 답습).
 * 마운트/전환 시 GET. update()는 PATCH 후 응답으로 직접 setState(왕복 1회).
 * 400 응답은 throw → 호출자(ProfileForm)가 에러 메시지 처리(AC-14).
 * T8-4: authHeaders spread + crewId 를 effect 의존성에 추가(전환 시 무효화).
 */
export function useProfile() {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // E-3(REWORK v2 P1-3): 전환 시 이전 사용자 프로필 즉시 리셋 후 fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setLoading(true);
    fetch("/api/profile", { ...NO_STORE, headers: authHeaders(user) })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ProfileResponse | null) => {
        if (!active) return;
        setData(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId]);

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
    return json;
    },
    [user],
  );

  return { data, loading, update };
}
