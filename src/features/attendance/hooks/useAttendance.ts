"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AttendanceRecord,
  ClockInStatus,
  ClockOutStatus,
  EditRequest,
  WorkStatus,
} from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { nowHHMM } from "@/lib/date";
import { clockPhase, type ClockPhase } from "@/features/attendance/domain";
import { invalidateCache } from "@/lib/client-cache";

const NO_STORE: RequestInit = { cache: "no-store" };
// perf: 출퇴근 캐시 prefix(crewId 포함 key). mutation 후 invalidateCache(ATT_PREFIX)로 일괄 무효화.
const ATT_PREFIX = "att|";

/**
 * 월간 레코드 fetch + 상태변경 mutate. (architect §4.1)
 * T8-4: authHeaders spread + crewId 를 effect 의존성에 추가(전환 시 무효화, active cleanup 유지).
 * REWORK v2 / P1-2 / AC-11: targetCrewId 제공 시 ?crewId= 로 전달 → 마스터 드릴다운(대상 멤버 조회).
 *   멤버는 서버 enforceReadScope 가 무시(본인 강제)하므로 안전. 미제공 시 본인 스코프(회귀 0).
 */
export function useMonthAttendance(month: string, targetCrewId?: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const queryClient = useQueryClient();

  // 마스터 드릴다운 시 대상 멤버를 쿼리로 부착(미제공 시 URL 불변 → 회귀 0).
  const query = targetCrewId
    ? `month=${month}&crewId=${targetCrewId}`
    : `month=${month}`;
  // 캐시 key: scope(crewId/target) 포함 → cross-user 누수 0.
  const scopeKey = `${crewId}|${targetCrewId ?? "self"}`;
  const queryKey = useMemo(
    () => [ATT_PREFIX, "month", scopeKey, month] as const,
    [month, scopeKey],
  );
  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/attendance?${query}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok ? ((await res.json()) as AttendanceRecord[]) : [];
    },
  });

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return { records: queryResult.data ?? [], loading: queryResult.isLoading, reload };
}

/** 단일일 상세 fetch + 상태변경 PATCH. T8-4: authHeaders + crewId 의존성. */
export function useDayAttendance(date: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => [ATT_PREFIX, "day", crewId, date] as const,
    [crewId, date],
  );
  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/attendance/${date}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok ? ((await res.json()) as AttendanceRecord | null) : null;
    },
  });

  // mutation 후 공유 캐시 무효화 — 같은 날을 보는 다른 컴포넌트/월 집계가 다음 read 시 fresh.
  const applyMutated = useCallback(
    (next: AttendanceRecord) => {
      queryClient.setQueryData(queryKey, next);
      void queryClient.invalidateQueries({ queryKey: [ATT_PREFIX, "month"] });
      void queryClient.invalidateQueries({ queryKey: ["pay|"] });
    },
    [queryClient, queryKey],
  );

  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const changeStatus = useCallback(
    async (status: WorkStatus) => {
      const res = await fetch(`/api/attendance?date=${date}`, {
        method: "PATCH",
        headers: authHeaders(user),
        body: JSON.stringify({ status }),
      });
      if (res.ok) applyMutated(await res.json());
    },
    [date, user, applyMutated],
  );

  const changeClockInStatus = useCallback(
    async (clockInStatus: ClockInStatus) => {
      const res = await fetch(`/api/attendance?date=${date}`, {
        method: "PATCH",
        headers: authHeaders(user),
        body: JSON.stringify({ clockInStatus }),
      });
      if (res.ok) applyMutated(await res.json());
    },
    [date, user, applyMutated],
  );

  const changeClockOutStatus = useCallback(
    async (clockOutStatus: ClockOutStatus) => {
      const res = await fetch(`/api/attendance?date=${date}`, {
        method: "PATCH",
        headers: authHeaders(user),
        body: JSON.stringify({ clockOutStatus }),
      });
      if (res.ok) applyMutated(await res.json());
    },
    [date, user, applyMutated],
  );

  return {
    record: queryResult.data ?? null,
    loading: queryResult.isLoading,
    reload,
    changeStatus,
    changeClockInStatus,
    changeClockOutStatus,
  };
}

export interface UseTodayClock {
  record: AttendanceRecord | null;
  phase: ClockPhase; // !clockIn→before, !clockOut→working, else done
  busy: boolean; // PATCH in-flight 가드(E-2)
  clockIn: (time?: string) => Promise<AttendanceRecord | null>;
  clockOut: (time?: string) => Promise<AttendanceRecord | null>;
}

/**
 * 오늘 출퇴근 등록 공용 훅(단일 진실원, T11 ST-1). ClockToggle 인라인 로직 1:1 이관.
 *   GET `/api/attendance/${date}`(no-store, authHeaders) → phase → PATCH `/api/attendance?date=`
 *   {field, time:nowHHMM()}(authHeaders) → setRecord. ClockToggle/ClockFab 가 공유(동작 불변, AC-R2).
 *   crewId(= user.crewId ?? user.id) effect 의존성으로 전환 시 setRecord(null) 동기 리셋·재fetch.
 *   busy 가드로 중복 PATCH 방지(E-2). clock 결과 record 반환 → res.ok 시 콜백 트리거(FAB).
 */
export function useTodayClock(date: string): UseTodayClock {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => [ATT_PREFIX, "day", crewId, date] as const,
    [crewId, date],
  );
  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/attendance/${date}`, {
        ...NO_STORE,
        headers: authHeaders(user),
      });
      return res.ok ? ((await res.json()) as AttendanceRecord | null) : null;
    },
  });
  const record = queryResult.data ?? null;

  const clock = useCallback(
    async (field: "clockIn" | "clockOut", time?: string) => {
      setBusy(true);
      // P2-1: 호출부가 캡처한 시각을 주입하면 그 값을 PATCH(표시 시각 = 저장 시각).
      //   미전달 시 기존대로 nowHHMM() 호출(회귀 0).
      const res = await fetch(`/api/attendance?date=${date}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(user) },
        body: JSON.stringify({ field, time: time ?? nowHHMM() }),
      });
      let next: AttendanceRecord | null = null;
      if (res.ok) {
        next = await res.json();
        queryClient.setQueryData(queryKey, next);
        void queryClient.invalidateQueries({ queryKey: [ATT_PREFIX, "month"] });
        void queryClient.invalidateQueries({ queryKey: ["pay|"] });
      }
      setBusy(false);
      return next;
    },
    [date, user, queryClient, queryKey],
  );

  const clockIn = useCallback((time?: string) => clock("clockIn", time), [clock]);
  const clockOut = useCallback(
    (time?: string) => clock("clockOut", time),
    [clock],
  );

  return { record, phase: clockPhase(record), busy, clockIn, clockOut };
}

/** 수정요청 내역 fetch + 생성 POST. T8-4: authHeaders + crewId 의존성. */
export function useEditRequests() {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<EditRequest[]>([]);

  const reload = useCallback(async () => {
    const res = await fetch("/api/attendance/requests", {
      ...NO_STORE,
      headers: authHeaders(user),
    });
    setRequests(res.ok ? await res.json() : []);
  }, [user]);

  useEffect(() => {
    let active = true;
    // E-3(REWORK v2 P1-3): 전환 시 이전 사용자 요청목록 즉시 리셋 후 fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRequests([]);
    fetch("/api/attendance/requests", {
      ...NO_STORE,
      headers: authHeaders(user),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((json: EditRequest[]) => {
        if (active) setRequests(json);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId]);

  const submit = useCallback(
    async (body: {
      date: string;
      reason: string;
      after: EditRequest["after"];
    }) => {
      const res = await fetch("/api/attendance/requests", {
        method: "POST",
        headers: authHeaders(user),
        body: JSON.stringify(body),
      });
      if (res.ok) await reload();
      return res.ok;
    },
    [reload, user],
  );

  // 수정요청 수락(AC-9/AC-18): POST 후 목록 reload. ok 반환. authHeaders 로 마스터 게이트 통과.
  const approve = useCallback(
    async (id: string) => {
      const res = await fetch("/api/attendance/requests/approve", {
        method: "POST",
        headers: authHeaders(user),
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        invalidateCache(ATT_PREFIX); // 수락은 대상 멤버의 출퇴근 레코드를 바꿈 → 출퇴근 캐시 무효화
        invalidateCache("pay|"); // 급여(파생)도 무효화
        void queryClient.invalidateQueries({ queryKey: [ATT_PREFIX] });
        void queryClient.invalidateQueries({ queryKey: ["pay|"] });
        await reload();
      }
      return res.ok;
    },
    [queryClient, reload, user],
  );

  return { requests, reload, submit, approve };
}
