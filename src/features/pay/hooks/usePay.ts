"use client";

import { useCallback, useEffect, useState } from "react";
import type { PayResponse, PayDetail } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

/**
 * T8-4: authHeaders spread + crewId 를 effect 의존성에 추가(전환 시 무효화).
 * targetCrewId: 마스터가 특정 멤버 급여/명세서를 조회할 때 ?crewId 로 타겟(멤버는 서버가 본인 강제).
 * reload: 명세서 입력 저장 후 재조회용.
 */
export function useMonthPay(month: string, targetCrewId?: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [data, setData] = useState<PayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let active = true;
    // E-3(REWORK v2 P1-3): 전환·월변경 시 이전 사용자 급여 즉시 리셋 후 fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setLoading(true);
    const qs = targetCrewId ? `?month=${month}&crewId=${targetCrewId}` : `?month=${month}`;
    fetch(`/api/pay${qs}`, { ...NO_STORE, headers: authHeaders(user) })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: PayResponse | null) => {
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

  useEffect(() => {
    let active = true;
    // E-3(REWORK v2 P1-3): 전환·날짜변경 시 이전 사용자 급여상세 즉시 리셋 후 fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    setLoading(true);
    fetch(`/api/pay/${date}`, { ...NO_STORE, headers: authHeaders(user) })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: PayDetail | null) => {
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
