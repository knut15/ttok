"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PayResponse, PayDetail } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

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
  const queryClient = useQueryClient();
  const scopeKey = `${crewId}|${targetCrewId ?? "self"}`;
  const query = useQuery({
    queryKey: [PAY_PREFIX, "month", scopeKey, month],
    queryFn: async () => {
      const qs = targetCrewId ? `?month=${month}&crewId=${targetCrewId}` : `?month=${month}`;
      const res = await fetch(`/api/pay${qs}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok ? ((await res.json()) as PayResponse) : null;
    },
  });
  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [PAY_PREFIX, "month", scopeKey] });
  }, [queryClient, scopeKey]);

  return { data: query.data ?? null, loading: query.isLoading, reload };
}

export function useDayPay(date: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const query = useQuery({
    queryKey: [PAY_PREFIX, "day", crewId, date],
    queryFn: async () => {
      const res = await fetch(`/api/pay/${date}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok ? ((await res.json()) as PayDetail) : null;
    },
  });

  return { detail: query.data ?? null, loading: query.isLoading };
}
