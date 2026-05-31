"use client";

// 마스터 집계 훅(T8-5). GET /api/master/crews?month= (authHeaders + month state).
// client 는 store 직접 import 금지 → route 경유. 전환/월변경 시 재fetch(active cleanup).
import { useEffect, useState } from "react";
import type { CrewSummary, MasterSummaryResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

export function useMasterSummary(month: string) {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/master/crews?month=${month}`, {
      ...NO_STORE,
      headers: authHeaders(user),
    })
      .then((res) => (res.ok ? (res.json() as Promise<MasterSummaryResponse>) : null))
      .then((json) => {
        if (!active) return;
        setCrews(json?.crews ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, crewId, user.role]);

  return { crews, loading };
}
