"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { ClockToggle } from "@/features/attendance/components/ClockToggle";
import { formatDotDate, todayDate } from "@/lib/date";

// 마운트 여부 구독(서버 스냅샷 false → CSR true). useSyncExternalStore 로
// 하이드레이션 불일치·setState-in-effect 없이 client-only 분기.
const emptySubscribe = () => () => {};

// 홈 날짜 헤더 + 출퇴근 토글(client-only, AC-T6-2~4).
// 정적 프리렌더에서 서버 new Date()가 build 시각으로 고정 + 하이드레이션 불일치 위험 →
// 마운트 후 클라이언트 로컬 날짜 계산. 마운트 전 placeholder(SSR/CSR 텍스트 일치).
export function HomeToday() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const today = mounted ? todayDate() : null;

  if (today === null) {
    return (
      <>
        <div
          aria-hidden
          className="flex items-center justify-between text-base font-bold text-foreground"
        >
          <span className="h-5 w-32 animate-pulse rounded bg-black/10" />
          <span className="text-muted">›</span>
        </div>
        <Card aria-hidden>
          <div className="h-5 w-40 animate-pulse rounded bg-black/10" />
          <div className="mt-3 h-6 w-48 animate-pulse rounded bg-black/10" />
          <div className="mt-3 h-2 w-full animate-pulse rounded bg-black/10" />
          <div className="mt-4 h-12 w-full animate-pulse rounded-xl bg-black/10" />
        </Card>
      </>
    );
  }

  return (
    <>
      <Link
        href="/attendance"
        className="flex items-center justify-between text-base font-bold text-foreground"
      >
        <span>{formatDotDate(today)}</span>
        <span className="text-muted">›</span>
      </Link>

      <ClockToggle date={today} />
    </>
  );
}
