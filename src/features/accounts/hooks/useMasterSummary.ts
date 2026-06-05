"use client";

// 마스터 집계 훅(T8-5). GET /api/master/crews?month= (authHeaders + month state).
// client 는 store 직접 import 금지 → route 경유. 전환/월변경 시 재fetch(active cleanup).
// perf: 공유 캐시(dedup+TTL) — 월 재진입 즉시 표시. reload(매니저 토글 등)는 캐시 무효화 후 재집계.
import { useCallback, useEffect, useState } from "react";
import type { CrewSummary, MasterSummaryResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { cachedJSON, invalidateCache } from "@/lib/client-cache";

const NO_STORE: RequestInit = { cache: "no-store" };
const MCREWS_PREFIX = "mcrews|";

export function useMasterSummary(month: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheKey = `${MCREWS_PREFIX}${crewId}|${month}`;
  // reload 트리거(매니저 토글 등 mutation 후 재집계).
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => {
    invalidateCache(`${MCREWS_PREFIX}${crewId}`); // 매니저 토글 등으로 집계 변동 → 무효화
    setTick((t) => t + 1);
  }, [crewId]);

  useEffect(() => {
    let active = true;
    cachedJSON<MasterSummaryResponse>(cacheKey, `/api/master/crews?month=${month}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    }).then((json) => {
      if (!active) return;
      setCrews(json?.crews ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, crewId, user.role, tick]);

  return { crews, loading, reload };
}
