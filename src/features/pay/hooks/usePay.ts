"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PayResponse, PayDetail } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { cachedJSON, invalidateCache } from "@/lib/client-cache";

const NO_STORE: RequestInit = { cache: "no-store" };
// 급여 캐시 prefix(crewId 포함 key). 출퇴근 변경 시 useAttendance 가 이 prefix 를 무효화한다(급여=출퇴근 파생).
export const PAY_PREFIX = "pay|";

/**
 * T8-4: authHeaders spread + crewId 를 effect 의존성에 추가(전환 시 무효화).
 * targetCrewId: 마스터가 특정 멤버 급여/명세서를 조회할 때 ?crewId 로 타겟(멤버는 서버가 본인 강제).
 * reload: 명세서 입력 저장 후 재조회용.
 * perf: 공유 캐시(dedup+TTL) — 같은 월 재진입 즉시 표시, 사용자 전환 시에만 동기 리셋.
 */
export function useMonthPay(month: string, targetCrewId?: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [data, setData] = useState<PayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const scopeKey = `${crewId}|${targetCrewId ?? "self"}`;
  const cacheKey = `${PAY_PREFIX}month|${scopeKey}|${month}`;
  const prevScope = useRef(scopeKey);
  const reload = useCallback(() => {
    invalidateCache(cacheKey);
    setReloadKey((k) => k + 1);
  }, [cacheKey]);

  useEffect(() => {
    let active = true;
    // E-3: 사용자 전환 시에만 즉시 리셋(타인 급여 1프레임 노출 0). 월 변경은 캐시 히트로 즉시.
    if (prevScope.current !== scopeKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      prevScope.current = scopeKey;
    }
    setLoading(true);
    const qs = targetCrewId ? `?month=${month}&crewId=${targetCrewId}` : `?month=${month}`;
    cachedJSON<PayResponse>(cacheKey, `/api/pay${qs}`, {
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
  }, [month, crewId, targetCrewId, reloadKey]);

  return { data, loading, reload };
}

export function useDayPay(date: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [detail, setDetail] = useState<PayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheKey = `${PAY_PREFIX}day|${crewId}|${date}`;
  const prevCrew = useRef(crewId);

  useEffect(() => {
    let active = true;
    // E-3: 사용자 전환 시에만 즉시 리셋. 같은 사용자 날짜 변경은 캐시 히트로 즉시.
    if (prevCrew.current !== crewId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      prevCrew.current = crewId;
    }
    setLoading(true);
    cachedJSON<PayDetail>(cacheKey, `/api/pay/${date}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    }).then((json) => {
      if (!active) return;
      setDetail(json);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, crewId]);

  return { detail, loading };
}
