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
 */
export function useMonthAttendance(month: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/attendance?month=${month}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    });
    setRecords(res.ok ? await res.json() : []);
    setLoading(false);
  }, [month, user]);

  useEffect(() => {
    let active = true;
    fetch(`/api/attendance?month=${month}`, {
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
  }, [month, crewId]);

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
