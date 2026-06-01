"use client";

// 급여 client 래퍼: 월 네비(‹ 라벨 › + picker, AttendanceCalendarView 패턴) +
// 매장명 + PayList 렌더. PayList/PaySummaryCard 가 month 기반으로 라벨 동적 표기.
import { useState, useSyncExternalStore } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { MonthPickerSheet } from "@/components/MonthPickerSheet";
import { PayList } from "./PayList";
import { STORE_NAME, SEED_MONTH, SEED_JOIN_DATE } from "@/lib/constants";
import { formatMonthLabel, shiftMonth, todayMonth } from "@/lib/date";

// 마운트 여부 구독(HomeToday/AttendanceCalendarView 동일 패턴).
// 서버/첫CSR false → SEED_MONTH 중립 스냅샷, 마운트 후 실제 현재월.
const emptySubscribe = () => () => {};

export function PayView() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  // 마운트 전 SEED_MONTH 중립 스냅샷(하이드레이션 0), 마운트 후 실제 현재월.
  // 사용자가 직접 고른 월(picked)이 있으면 우선.
  const [picked, setMonth] = useState<string | null>(null);
  const currentMonth = mounted ? todayMonth() : SEED_MONTH;
  const month = picked ?? currentMonth;
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <AppHeader
        title={
          <span className="flex items-center gap-3">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="grid h-8 w-8 place-items-center leading-none text-muted"
            >
              ‹
            </button>
            <MonthSelector
              label={formatMonthLabel(month)}
              onClick={() => setPickerOpen(true)}
            />
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="grid h-8 w-8 place-items-center leading-none text-muted"
            >
              ›
            </button>
          </span>
        }
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
      <MonthPickerSheet
        open={pickerOpen}
        current={month}
        joinMonth={SEED_JOIN_DATE.slice(0, 7)}
        currentMonth={currentMonth}
        onSelect={(m) => {
          setMonth(m);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
