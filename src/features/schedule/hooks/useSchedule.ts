"use client";

// 스케쥴 훅(T19). GET /api/schedule(월간 entries + canWrite) + /api/crews(근무자 메타).
// 작성/삭제는 POST/DELETE 경유 후 reload. client 는 store 직접 import 금지 → route 경유.
import { useCallback, useEffect, useState } from "react";
import type {
  Crew,
  FixedShift,
  ScheduleEntry,
  ScheduleResponse,
} from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { cachedJSON, invalidateCache } from "@/lib/client-cache";

const NO_STORE: RequestInit = { cache: "no-store" };
const SCHED_PREFIX = "sched|"; // 월간 스케쥴 캐시(crewId|month)
const CREWS_KEY = "crews|all"; // 매장 근무자 메타(전원 공통, 비scope)

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
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [fixedShifts, setFixedShifts] = useState<FixedShift[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const schedKey = `${SCHED_PREFIX}${crewId}|${month}`;
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => {
    invalidateCache(`${SCHED_PREFIX}${crewId}`); // 스케쥴 변경 → 해당 사용자 월 캐시 무효화
    invalidateCache(CREWS_KEY); // 근무자 메타도 함께 갱신(매니저/명단 변동 대비)
    setTick((t) => t + 1);
  }, [crewId]);

  useEffect(() => {
    let active = true;
    // perf: 두 GET 을 공유 캐시로 dedup(같은 페이지 다중 호출/재진입 → 단일 fetch). crews 는 전원 공통 key.
    Promise.all([
      cachedJSON<ScheduleResponse>(schedKey, `/api/schedule?month=${month}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      }),
      cachedJSON<Crew[]>(CREWS_KEY, `/api/crews`, NO_STORE),
    ]).then(([sch, cr]) => {
      if (!active) return;
      setEntries(sch?.entries ?? []);
      setFixedShifts(sch?.fixedShifts ?? []);
      setCanWrite(sch?.canWrite ?? false);
      setCrews(cr ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, crewId, user.role, tick]);

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
    entries,
    fixedShifts,
    canWrite,
    crews,
    loading,
    reload,
    save,
    remove,
    saveFixed,
    updateFixed,
    removeFixed,
  };
}
