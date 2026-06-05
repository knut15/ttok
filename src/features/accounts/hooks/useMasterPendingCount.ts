"use client";

// 마스터 대기 알림 카운트 — 멤버 근태변경 수정요청 + 대타 승인 대기 합산. 마스터만 폴링.
// mock 환경(실시간 푸시 없음) → 짧은 주기 폴링으로 "새 승인 요청 발생" 을 감지.
// client 는 store 직접 import 금지 → /api/master/* 경유(마스터 게이트 403 → 0).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { MasterRequestsResponse, MasterSubstitutesResponse } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const POLL_MS = 30000;

export function useMasterPendingCount(): number {
  const { user } = useCurrentUser();
  const crewId = user.crewId ?? user.id;
  const isMaster = user.role === "master";
  // /master 대시보드는 동일 카운트를 화면에 직접 렌더 → 배지 폴링 생략(중복 4요청 + 주기 제거).
  const onMaster = usePathname()?.startsWith("/master") ?? false;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isMaster || onMaster) return; // 비마스터·대시보드에서는 폴링 안 함.
    let active = true;
    const load = () =>
      Promise.all([
        fetch("/api/master/requests", { cache: "no-store", headers: authHeaders(user) })
          .then((res) => (res.ok ? (res.json() as Promise<MasterRequestsResponse>) : null)),
        fetch("/api/master/substitutes", { cache: "no-store", headers: authHeaders(user) })
          .then((res) => (res.ok ? (res.json() as Promise<MasterSubstitutesResponse>) : null)),
      ]).then(([req, sub]) => {
        if (!active) return;
        const requests = req?.requests.filter((r) => r.status === "대기").length ?? 0;
        const substitutes = sub?.substitutes.length ?? 0;
        setCount(requests + substitutes);
      });
    load();
    // perf: 백그라운드 탭에선 폴링 생략(보이지 않으면 0 요청), 복귀 시 1회 즉시 갱신.
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaster, onMaster, crewId]);

  // 비마스터는 항상 0(전환 직후 stale count 노출 방지).
  return isMaster ? count : 0;
}
