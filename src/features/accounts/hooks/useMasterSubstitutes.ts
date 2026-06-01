"use client";

// 마스터 대타 승인 훅. GET /api/master/substitutes(대기 목록) + approve(id).
// useMasterRequests 패턴: client 는 route 경유, active cleanup, 승인 후 reload.
import { useCallback, useEffect, useState } from "react";
import type { MasterSubstituteRow, MasterSubstitutesResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

export function useMasterSubstitutes() {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [substitutes, setSubstitutes] = useState<MasterSubstituteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/master/substitutes", { ...NO_STORE, headers: authHeaders(user) })
      .then((res) => (res.ok ? (res.json() as Promise<MasterSubstitutesResponse>) : null))
      .then((json) => {
        if (!active) return;
        setSubstitutes(json?.substitutes ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, user.role, reloadKey]);

  const approve = useCallback(
    async (id: string) => {
      const res = await fetch("/api/master/substitutes/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(user) },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setReloadKey((k) => k + 1);
    },
    [user],
  );

  return { substitutes, loading, approve };
}
