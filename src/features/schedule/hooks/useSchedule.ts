"use client";

// 스케쥴 훅(T19). GET /api/schedule(월간 entries + canWrite) + /api/crews(근무자 메타).
// 작성/삭제는 POST/DELETE 경유 후 reload. client 는 store 직접 import 금지 → route 경유.
import { useCallback, useEffect, useState } from "react";
import type {
  Crew,
  DayType,
  FixedShift,
  ScheduleEntry,
  ScheduleResponse,
} from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

export interface SaveScheduleInput {
  date: string;
  crewId: string;
  startTime: string;
  endTime: string;
  off?: boolean;
}

export interface SaveFixedInput {
  crewId: string;
  dayType: DayType;
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
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/schedule?month=${month}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      }).then((r) => (r.ok ? (r.json() as Promise<ScheduleResponse>) : null)),
      fetch(`/api/crews`, NO_STORE).then((r) =>
        r.ok ? (r.json() as Promise<Crew[]>) : null,
      ),
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

  const removeFixed = useCallback(
    async (crewId: string, dayType: DayType): Promise<boolean> => {
      const res = await fetch(`/api/schedule/fixed`, {
        ...NO_STORE,
        method: "DELETE",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify({ crewId, dayType }),
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
    removeFixed,
  };
}
