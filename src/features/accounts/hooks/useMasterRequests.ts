"use client";

// 마스터 수정요청 컨펌 훅(FR-2). GET /api/master/requests(authHeaders master) +
// approve(id)=기존 POST /api/attendance/requests/approve 재사용 → reload.
// useMasterSummary 패턴: client 는 store 직접 import 금지(route 경유), active cleanup.
import { useCallback, useEffect, useState } from "react";
import type { MasterRequestRow, MasterRequestsResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

export function useMasterRequests() {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [requests, setRequests] = useState<MasterRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/master/requests", { ...NO_STORE, headers: authHeaders(user) })
      .then((res) =>
        res.ok ? (res.json() as Promise<MasterRequestsResponse>) : null,
      )
      .then((json) => {
        if (!active) return;
        setRequests(json?.requests ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, user.role, reloadKey]);

  const approve = useCallback(
    async (id: string) => {
      const res = await fetch("/api/attendance/requests/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(user) },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setReloadKey((k) => k + 1);
    },
    [user],
  );

  return { requests, loading, approve };
}
