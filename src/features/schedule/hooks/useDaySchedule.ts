"use client";

// 특정 날짜·현재 사용자의 예정 스케쥴 1건(T21 비교용). 월간 GET 후 (date, crewId) 필터.
import { useEffect, useState } from "react";
import type { ScheduleEntry, ScheduleResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

export function useDaySchedule(date: string): ScheduleEntry | null {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const month = date.slice(0, 7);
  const [entry, setEntry] = useState<ScheduleEntry | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/schedule?month=${month}`, {
      cache: "no-store",
      headers: authHeaders(user),
    })
      .then((r) => (r.ok ? (r.json() as Promise<ScheduleResponse>) : null))
      .then((json) => {
        if (!active) return;
        setEntry(
          json?.entries.find((e) => e.date === date && e.crewId === crewId) ?? null,
        );
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, month, crewId]);

  return entry;
}
