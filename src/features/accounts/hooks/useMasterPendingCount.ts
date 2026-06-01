"use client";

// 마스터 대기 수정요청 알림 카운트(크루 근태변경 → 승인 대기). 마스터만 폴링.
// mock 환경(실시간 푸시 없음) → 짧은 주기 폴링으로 "새 승인 요청 발생" 을 감지.
// client 는 store 직접 import 금지 → /api/master/requests 경유(마스터 게이트 403 → 0).
import { useEffect, useState } from "react";
import type { MasterRequestsResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const POLL_MS = 10000;

export function useMasterPendingCount(): number {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const isMaster = user.role === "master";
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isMaster) return; // 비마스터는 폴링 안 함(반환값에서 0 으로 강제).
    let active = true;
    const load = () =>
      fetch("/api/master/requests", { cache: "no-store", headers: authHeaders(user) })
        .then((res) => (res.ok ? (res.json() as Promise<MasterRequestsResponse>) : null))
        .then((json) => {
          if (!active || !json) return;
          setCount(json.requests.filter((r) => r.status === "대기").length);
        });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, crewId]);

  // 비마스터는 항상 0(전환 직후 stale count 노출 방지).
  return isMaster ? count : 0;
}
