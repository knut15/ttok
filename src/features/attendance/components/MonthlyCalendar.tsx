"use client";

import { useEffect, useMemo } from "react";
import { useMonthAttendance } from "@/features/attendance/hooks/useAttendance";
import { buildMonthGrid } from "@/lib/date";
import { CalendarCell, type CellView } from "./CalendarCell";
import type { AttendanceRecord } from "@/types";

const WEEK_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

// 근무 있는 상태(정상/지각/조퇴/연장) → 출/퇴 시각 + 상태명. 결근·휴가 → 상태명만.
const STATUS_STYLE: Record<string, string> = {
  지각: "text-orange-400",
  결근: "text-red-400",
  휴가: "text-gray-400",
  조퇴: "text-yellow-400",
  연장: "text-teal-400",
  대타: "text-violet-400",
};
const WORKED_STATUSES: readonly string[] = ["정상", "지각", "조퇴", "연장", "대타"];

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
      return { date, dayNum, clockIn: null, clockOut: null, statusLabel: null, statusColor: null };
    }
    // 근무 있는 상태(정상/지각/조퇴/연장) → 출/퇴 시각. 비정상은 그 하단에 상태명+색.
    // 결근·휴가(무근무) → 시각 없이 상태명만.
    const statusColor = STATUS_STYLE[rec.status] ?? null;
    const worked = WORKED_STATUSES.includes(rec.status);
    return {
      date,
      dayNum,
      clockIn: worked ? rec.clockIn : null,
      clockOut: worked ? rec.clockOut : null,
      statusLabel: statusColor ? rec.status : null,
      statusColor,
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
