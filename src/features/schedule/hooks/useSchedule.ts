"use client";

// 스케쥴 훅(T19). GET /api/schedule(월간 entries + canWrite) + /api/crews(근무자 메타).
// 작성/삭제는 POST/DELETE 경유 후 reload. client 는 store 직접 import 금지 → route 경유.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Crew, ScheduleResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };
const SCHED_QUERY = "schedule";
const CREWS_QUERY = "crews";

export interface SaveScheduleInput {
  date: string;
  crewId: string;
  startTime: string;
  endTime: string;
  off?: boolean;
}

export interface SaveFixedInput {
  crewId: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export interface UpdateFixedInput {
  id: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export function useSchedule(month: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const queryClient = useQueryClient();
  const scheduleQuery = useQuery({
    queryKey: [SCHED_QUERY, crewId, user.role, month],
    queryFn: async () => {
      const res = await fetch(`/api/schedule?month=${month}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok
        ? ((await res.json()) as ScheduleResponse)
        : { month, entries: [], fixedShifts: [], canWrite: false };
    },
  });
  const crewsQuery = useQuery({
    queryKey: [CREWS_QUERY, crewId, user.role],
    queryFn: async () => {
      const res = await fetch("/api/crews", NO_STORE);
      return res.ok ? ((await res.json()) as Crew[]) : [];
    },
  });
  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [SCHED_QUERY, crewId] });
    void queryClient.invalidateQueries({ queryKey: [CREWS_QUERY, crewId] });
  }, [crewId, queryClient]);

  const save = useCallback(
    async (input: SaveScheduleInput): Promise<boolean> => {
      const res = await fetch(`/api/schedule`, {
        ...NO_STORE,
        method: "POST",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) reload();
      return res.ok;
    },
    [user, reload],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await fetch(`/api/schedule/${id}`, {
        ...NO_STORE,
        method: "DELETE",
        headers: authHeaders(user),
      });
      if (res.ok) reload();
      return res.ok;
    },
    [user, reload],
  );

  const saveFixed = useCallback(
    async (input: SaveFixedInput): Promise<boolean> => {
      const res = await fetch(`/api/schedule/fixed`, {
        ...NO_STORE,
        method: "POST",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) reload();
      return res.ok;
    },
    [user, reload],
  );

  const updateFixed = useCallback(
    async (input: UpdateFixedInput): Promise<boolean> => {
      const res = await fetch(`/api/schedule/fixed`, {
        ...NO_STORE,
        method: "PATCH",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) reload();
      return res.ok;
    },
    [user, reload],
  );

  const removeFixed = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await fetch(`/api/schedule/fixed`, {
        ...NO_STORE,
        method: "DELETE",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) reload();
      return res.ok;
    },
    [user, reload],
  );

  return {
    entries: scheduleQuery.data?.entries ?? [],
    fixedShifts: scheduleQuery.data?.fixedShifts ?? [],
    canWrite: scheduleQuery.data?.canWrite ?? false,
    crews: crewsQuery.data ?? [],
    loading: scheduleQuery.isLoading || crewsQuery.isLoading,
    reload,
    save,
    remove,
    saveFixed,
    updateFixed,
    removeFixed,
  };
}
