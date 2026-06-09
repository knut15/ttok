"use client";

// 급여 client 래퍼: 월 네비(‹ 라벨 › + picker, AttendanceCalendarView 패턴) +
// 매장명 + PayList 렌더. PayList/PaySummaryCard 가 month 기반으로 라벨 동적 표기.
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { MonthBar } from "@/components/MonthBar";
import { StoreBar } from "@/components/StoreBar";
import { MonthPickerSheet } from "@/components/MonthPickerSheet";
import { PayList } from "./PayList";
import { SEED_MONTH, SEED_JOIN_DATE } from "@/lib/constants";
import { todayMonth } from "@/lib/date";

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
      <StoreBar
        right={
          <Link
            href={`/pay/statement?month=${month}`}
            className="rounded-full border border-foreground/10 px-3 py-1.5 text-xs font-semibold"
          >
            급여명세서
          </Link>
        }
      />
      <MonthBar
        month={month}
        onChange={setMonth}
        onPick={() => setPickerOpen(true)}
      />
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
