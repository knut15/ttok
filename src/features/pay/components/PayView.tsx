"use client";

// 급여 client 래퍼(AC-T6-8): 기본월을 실제 현재월로 계산(mount-gate) +
// 월 라벨 헤더 + 매장명 + PayList 렌더. PayList/PaySummaryCard 시그니처 불변(month prop 재사용).
// 월 네비(‹›/picker)는 본 범위 밖 — 기본월만 현재월로. (AC-T6-8 주의 참조)
import { useSyncExternalStore } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PayList } from "./PayList";
import { STORE_NAME, SEED_MONTH } from "@/lib/constants";
import { formatMonthLabel, todayMonth } from "@/lib/date";

// 마운트 여부 구독(HomeToday/AttendanceCalendarView 동일 패턴).
// 서버/첫CSR false → SEED_MONTH 중립 스냅샷, 마운트 후 실제 현재월.
const emptySubscribe = () => () => {};

export function PayView() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const month = mounted ? todayMonth() : SEED_MONTH;

  return (
    <div>
      <AppHeader
        title={`${formatMonthLabel(month)} ▾`}
        right={
          <span className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold">
            급여명세서
          </span>
        }
      />
      <div className="flex items-center gap-2 px-5 pb-3 text-base font-bold">
        <span aria-hidden>🏪</span>
        <span className="truncate">{STORE_NAME}</span>
      </div>
      <PayList month={month} />
    </div>
  );
}
