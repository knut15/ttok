"use client";

// 스케쥴 월간 캘린더(T19/T20-4). 날짜 셀에 등록 근무자 아바타 표기, 탭 → 편집 시트.
import { useMemo } from "react";
import { buildMonthGrid } from "@/lib/date";
import type { Crew, ScheduleAssignee, ScheduleEntry } from "@/types";
import { ScheduleDayCell, type ScheduleCellView } from "./ScheduleDayCell";

const WEEK_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

export function ScheduleCalendar({
  month,
  entries,
  crews,
  loading,
  onSelectDate,
}: {
  month: string;
  entries: ScheduleEntry[];
  crews: Crew[];
  loading: boolean;
  onSelectDate: (date: string) => void;
}) {
  const crewMeta = useMemo(() => {
    const m = new Map<string, Crew>();
    for (const c of crews) m.set(c.id, c);
    return m;
  }, [crews]);

  const byDate = useMemo(() => {
    const m = new Map<string, ScheduleAssignee[]>();
    for (const e of entries) {
      const c = crewMeta.get(e.crewId);
      const list = m.get(e.date) ?? [];
      list.push({
        crewId: e.crewId,
        name: c?.name ?? e.crewId,
        avatarInitial: c?.avatarInitial ?? "?",
        off: e.off === true,
        fixed: e.source === "fixed",
      });
      m.set(e.date, list);
    }
    return m;
  }, [entries, crewMeta]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const views: (ScheduleCellView | null)[] = cells.map((date) =>
    date
      ? { date, dayNum: Number(date.slice(-2)), assignees: byDate.get(date) ?? [] }
      : null,
  );

  return (
    <div className="px-4">
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium">
        {WEEK_HEADERS.map((w, i) => (
          <span
            key={w}
            className={i === 0 ? "text-coral" : i === 6 ? "text-statusblue" : "text-muted"}
          >
            {w}
          </span>
        ))}
      </div>
      {loading && <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>}
      <div className="grid grid-cols-7">
        {views.map((view, i) => (
          <ScheduleDayCell
            key={i}
            view={view}
            weekendTone={i % 7 === 0 ? "sun" : i % 7 === 6 ? "sat" : undefined}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
