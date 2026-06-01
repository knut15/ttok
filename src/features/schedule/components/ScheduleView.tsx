"use client";

// 스케쥴 호스트 뷰(T19). 월 이동 + 캘린더 + 날짜 편집 시트.
// 읽기는 전원, 작성(추가/수정/삭제)은 canWrite(master/매니저)만 — 시트가 분기 처리.
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { useSchedule } from "@/features/schedule/hooks/useSchedule";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { ScheduleDaySheet } from "./ScheduleDaySheet";
import { SEED_MONTH } from "@/lib/constants";
import { formatMonthLabel, shiftMonth } from "@/lib/date";

export function ScheduleView() {
  const [month, setMonth] = useState(SEED_MONTH);
  const [selected, setSelected] = useState<string | null>(null);
  const { entries, canWrite, crews, loading, save, remove } = useSchedule(month);

  const dayEntries = selected ? entries.filter((e) => e.date === selected) : [];

  return (
    <div className="pb-24">
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
            <MonthSelector label={formatMonthLabel(month)} />
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
      />
      <p className="px-5 pb-3 text-sm text-muted">
        근무 스케쥴{canWrite ? " · 날짜를 눌러 근무자를 배정하세요" : ""}
      </p>
      <ScheduleCalendar
        month={month}
        entries={entries}
        crews={crews}
        loading={loading}
        onSelectDate={setSelected}
      />
      {selected ? (
        <ScheduleDaySheet
          key={selected}
          date={selected}
          entries={dayEntries}
          crews={crews}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onSave={save}
          onRemove={remove}
        />
      ) : null}
    </div>
  );
}
