"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttendanceRecord, EditRequest, WorkStatus } from "@/types";

const NO_STORE: RequestInit = { cache: "no-store" };

/** 월간 레코드 fetch + 상태변경 mutate. effect 의존성 [month]만(architect §4.1). */
export function useMonthAttendance(month: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/attendance?month=${month}`, NO_STORE);
    setRecords(res.ok ? await res.json() : []);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    let active = true;
    fetch(`/api/attendance?month=${month}`, NO_STORE)
      .then((res) => (res.ok ? res.json() : []))
      .then((json: AttendanceRecord[]) => {
        if (!active) return;
        setRecords(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month]);

  return { records, loading, reload };
}

/** 단일일 상세 fetch + 상태변경 PATCH. */
export function useDayAttendance(date: string) {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/attendance/${date}`, NO_STORE);
    setRecord(res.ok ? await res.json() : null);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    let active = true;
    fetch(`/api/attendance/${date}`, NO_STORE)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: AttendanceRecord | null) => {
        if (!active) return;
        setRecord(json);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date]);

  const changeStatus = useCallback(
    async (status: WorkStatus) => {
      const res = await fetch(`/api/attendance?date=${date}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (res.ok) setRecord(await res.json());
    },
    [date],
  );

  return { record, loading, reload, changeStatus };
}

/** 수정요청 내역 fetch + 생성 POST. */
export function useEditRequests() {
  const [requests, setRequests] = useState<EditRequest[]>([]);

  const reload = useCallback(async () => {
    const res = await fetch("/api/attendance/requests", NO_STORE);
    setRequests(res.ok ? await res.json() : []);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/attendance/requests", NO_STORE)
      .then((res) => (res.ok ? res.json() : []))
      .then((json: EditRequest[]) => {
        if (active) setRequests(json);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = useCallback(
    async (body: {
      date: string;
      reason: string;
      after: EditRequest["after"];
    }) => {
      const res = await fetch("/api/attendance/requests", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) await reload();
      return res.ok;
    },
    [reload],
  );

  // 수정요청 수락(AC-9): POST 후 목록 reload. ok 반환.
  const approve = useCallback(
    async (id: string) => {
      const res = await fetch("/api/attendance/requests/approve", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      if (res.ok) await reload();
      return res.ok;
    },
    [reload],
  );

  return { requests, reload, submit, approve };
}
