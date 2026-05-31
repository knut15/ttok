"use client";

// 월 이동 client 래퍼(AC-10/11): month useState + ‹ 라벨 › 화살표 + 매장명 + 캘린더.
// page(RSC) 셸은 보존하고 월 상태를 이 경계로 지역화(architect §2.3).
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { STORE_NAME, SEED_MONTH } from "@/lib/constants";
import { formatMonthLabel, shiftMonth } from "@/lib/date";

export function AttendanceCalendarView() {
  const [month, setMonth] = useState<string>(SEED_MONTH);

  return (
    <div>
      <AppHeader
        title={
          <span className="flex items-center gap-3">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="text-muted"
            >
              ‹
            </button>
            <span>{formatMonthLabel(month)}</span>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="text-muted"
            >
              ›
            </button>
          </span>
        }
        right={<span className="text-muted">⤓</span>}
      />
      <div className="flex items-center gap-2 px-5 pb-3 text-sm font-semibold">
        <span aria-hidden>🏪</span>
        <span className="truncate">{STORE_NAME}</span>
      </div>
      <MonthlyCalendar month={month} />
    </div>
  );
}
