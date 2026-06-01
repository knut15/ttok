"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttendanceRecord, EditRequest, WorkStatus } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { nowHHMM } from "@/lib/date";
import { clockPhase, type ClockPhase } from "@/features/attendance/domain";

const NO_STORE: RequestInit = { cache: "no-store" };

/**
 * 월간 레코드 fetch + 상태변경 mutate. (architect §4.1)
 * T8-4: authHeaders spread + crewId 를 effect 의존성에 추가(전환 시 무효화, active cleanup 유지).
 * REWORK v2 / P1-2 / AC-11: targetCrewId 제공 시 ?crewId= 로 전달 → 마스터 드릴다운(대상 크루 조회).
 *   크루는 서버 enforceReadScope 가 무시(본인 강제)하므로 안전. 미제공 시 본인 스코프(회귀 0).
 */
export function useMonthAttendance(month: string, targetCrewId?: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 마스터 드릴다운 시 대상 크루를 쿼리로 부착(미제공 시 URL 불변 → 회귀 0).
  const query = targetCrewId
    ? `month=${month}&crewId=${targetCrewId}`
    : `month=${month}`;

  const reload = useCallback(async () => {
    const res = await fetch(`/api/attendance?${query}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    });
    setRecords(res.ok ? await res.json() : []);
    setLoading(false);
  }, [query, user]);

  useEffect(() => {
    let active = true;
    // E-3(REWORK v2 P1-3): 전환(crewId 변경)·월변경 시 이전 사용자 데이터 즉시 리셋 후 fetch.
    // key 의존성 변경 시 의도적 동기 리셋(stale 노출 0). React 권장 reset-on-deps 패턴.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecords([]);
    setLoading(true);
    fetch(`/api/attendance?${query}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((json: AttendanceRecord[]) => {
        if (!active) return;
        setRecords(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, crewId, targetCrewId]);

  return { records, loading, reload };
}

/** 단일일 상세 fetch + 상태변경 PATCH. T8-4: authHeaders + crewId 의존성. */
export function useDayAttendance(date: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/attendance/${date}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    });
    setRecord(res.ok ? await res.json() : null);
    setLoading(false);
  }, [date, user]);

  useEffect(() => {
    let active = true;
    // E-3(REWORK v2 P1-3): 전환·날짜변경 시 이전 데이터 즉시 리셋 후 fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecord(null);
    setLoading(true);
    fetch(`/api/attendance/${date}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: AttendanceRecord | null) => {
        if (!active) return;
        setRecord(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, crewId]);

  const changeStatus = useCallback(
    async (status: WorkStatus) => {
      const res = await fetch(`/api/attendance?date=${date}`, {
        method: "PATCH",
        headers: authHeaders(user),
        body: JSON.stringify({ status }),
      });
      if (res.ok) setRecord(await res.json());
    },
    [date, user],
  );

  return { record, loading, reload, changeStatus };
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
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    // 전환 시 이전 크루 레코드 즉시 리셋(stale 1프레임도 노출 금지). useAttendance/ClockToggle 동일 패턴.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecord(null);
    fetch(`/api/attendance/${date}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active) setRecord(json);
      });
    return () => {
      active = false;
    };
    // 식별 키(date, crewId)로 의존성 고정(ClockToggle 패턴 계승).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, crewId]);

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
        setRecord(next);
      }
      setBusy(false);
      return next;
    },
    [date, user],
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
      if (res.ok) await reload();
      return res.ok;
    },
    [reload, user],
  );

  return { requests, reload, submit, approve };
}
