"use client";

import { useEffect, useMemo } from "react";
import { useMonthAttendance } from "@/features/attendance/hooks/useAttendance";
import {
  formatBadge,
  shortWorkLabel,
  statusTone,
} from "@/features/attendance/domain";
import { buildMonthGrid } from "@/lib/date";
import { CalendarCell, type CellView } from "./CalendarCell";
import type { AttendanceRecord } from "@/types";

const WEEK_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

// 월간 캘린더(AC-13, AC-14): 그리드 셀 + 날짜 탭→상세 라우트.
// T11 ST-3(AC-6): reloadKey 증가 시 현재 월 useMonthAttendance.reload 재호출(FAB 등록 반영).
export function MonthlyCalendar({
  month,
  reloadKey,
}: {
  month: string;
  reloadKey?: number;
}) {
  const { records, loading, reload } = useMonthAttendance(month);

  useEffect(() => {
    // 초기 마운트(reloadKey 0/undefined)는 useMonthAttendance 자체 fetch 로 충분 → 중복 호출 회피.
    if (reloadKey) reload();
  }, [reloadKey, reload]);

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) map.set(r.date, r);
    return map;
  }, [records]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);

  const views: (CellView | null)[] = cells.map((date) => {
    if (!date) return null;
    const dayNum = Number(date.slice(-2));
    const rec = byDate.get(date);
    if (!rec) {
      return {
        date,
        dayNum,
        workLabel: null,
        badge: null,
        vacation: false,
        dotTone: null,
      };
    }
    return {
      date,
      dayNum,
      workLabel: rec.status === "휴가" ? null : shortWorkLabel(rec.workMinutes),
      badge: formatBadge(rec),
      vacation: rec.status === "휴가",
      dotTone: statusTone(rec.status),
    };
  });

  return (
    <div className="px-4">
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium">
        {WEEK_HEADERS.map((w, i) => (
          <span
            key={w}
            className={
              i === 0 ? "text-coral" : i === 6 ? "text-statusblue" : "text-muted"
            }
          >
            {w}
          </span>
        ))}
      </div>
      {loading && (
        <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
      )}
      <div className="grid grid-cols-7">
        {views.map((view, i) => (
          <CalendarCell
            key={i}
            view={view}
            weekendTone={i % 7 === 0 ? "sun" : i % 7 === 6 ? "sat" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
