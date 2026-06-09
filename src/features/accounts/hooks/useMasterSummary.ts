"use client";

// 마스터 집계 훅(T8-5). GET /api/master/crews?month= (authHeaders + month state).
// client 는 store 직접 import 금지 → route 경유. 전환/월변경 시 재fetch(active cleanup).
// perf: 공유 캐시(dedup+TTL) — 월 재진입 즉시 표시. reload(매니저 토글 등)는 캐시 무효화 후 재집계.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { CrewSummary, MasterSummaryResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };
const MCREWS_PREFIX = "mcrews|";
// 안정 참조: data 미도착 시 `?? []` 가 매 렌더 새 배열을 만들어, 소비처(MasterView/MemberList)의
// prevCrews 비교(렌더 중 조정)를 항상 깨 무한 리렌더를 유발 → 고정 빈 배열로 안정화.
const EMPTY_CREWS: CrewSummary[] = [];

export function useMasterSummary(month: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const queryClient = useQueryClient();
  const enabled = user.id !== "guest"; // 세션 확정 전(guest) 헛조회 방지
  const query = useQuery({
    queryKey: [MCREWS_PREFIX, crewId, month],
    queryFn: async () => {
      const res = await fetch(`/api/master/crews?month=${month}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok ? ((await res.json()) as MasterSummaryResponse) : { month, crews: [] };
    },
    enabled,
  });
  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [MCREWS_PREFIX, crewId] });
  }, [crewId, queryClient]);

  return { crews: query.data?.crews ?? EMPTY_CREWS, loading: query.isLoading || !enabled, reload };
}
