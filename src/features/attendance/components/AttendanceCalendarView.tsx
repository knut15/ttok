"use client";

// 월 이동 client 래퍼(AC-10/11): month useState + ‹ 라벨 › 화살표 + 매장명 + 캘린더.
// page(RSC) 셸은 보존하고 월 상태를 이 경계로 지역화(architect §2.3).
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { MonthPickerSheet } from "./MonthPickerSheet";
import { STORE_NAME, SEED_MONTH, SEED_JOIN_DATE } from "@/lib/constants";
import { formatMonthLabel, shiftMonth } from "@/lib/date";

export function AttendanceCalendarView() {
  const [month, setMonth] = useState<string>(SEED_MONTH);
  // 월 picker open state(AC-12/15). month 단일 소유 유지(setMonth 그대로).
  const [pickerOpen, setPickerOpen] = useState(false);

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
            <MonthSelector
              label={formatMonthLabel(month)}
              onClick={() => setPickerOpen(true)}
            />
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
      <MonthPickerSheet
        open={pickerOpen}
        current={month}
        joinMonth={SEED_JOIN_DATE.slice(0, 7)}
        currentMonth={SEED_MONTH}
        onSelect={(m) => {
          setMonth(m);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
