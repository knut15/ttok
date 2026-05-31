"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttendanceRecord, EditRequest, WorkStatus } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

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
