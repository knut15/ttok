// 스케줄 병합 뷰 순수 규칙(DB·store 비의존). 명시 배정(manual) + 고정근무 파생(fixed) 결합.
// 기존 store.ts getMonthScheduleView / isSubstituteAssignment 로직 이식.
import type { FixedShift, ScheduleEntry } from "@/types";
import { buildMonthGrid } from "./date";
import { getWeekdayIndex } from "./schedule";

/** 해당 날짜·멤버가 대타(그 요일 고정근무 없음)인가. off 면 false. */
export function isSubstitute(
  date: string,
  crewId: string,
  fixedShifts: FixedShift[],
  off?: boolean,
): boolean {
  if (off) return false;
  const w = getWeekdayIndex(date);
  return !fixedShifts.some((f) => f.crewId === crewId && f.weekdays.includes(w));
}

/**
 * 월간 병합 뷰: 명시 배정 우선 + 고정근무 자동적용. 같은 (date,crewId) 에 명시 있으면 고정 생략.
 * 고정 파생 항목은 id=`fixed-{crewId}-{date}`, source="fixed"(미저장 가상).
 */
export function mergeScheduleView(
  month: string,
  explicit: ScheduleEntry[],
  fixedShifts: FixedShift[],
): ScheduleEntry[] {
  const hasFixedOn = (crewId: string, date: string) => {
    const w = getWeekdayIndex(date);
    return fixedShifts.some((f) => f.crewId === crewId && f.weekdays.includes(w));
  };

  const explicitView: ScheduleEntry[] = explicit.map((e) => ({
    ...e,
    source: "manual",
    substitute: e.off !== true && !hasFixedOn(e.crewId, e.date),
  }));
  const explicitKeys = new Set(explicitView.map((e) => `${e.date}|${e.crewId}`));

  const derived: ScheduleEntry[] = [];
  if (fixedShifts.length > 0) {
    for (const date of buildMonthGrid(month)) {
      if (!date) continue;
      const weekday = getWeekdayIndex(date);
      for (const fs of fixedShifts) {
        if (!fs.weekdays.includes(weekday)) continue;
        if (explicitKeys.has(`${date}|${fs.crewId}`)) continue;
        derived.push({
          id: `fixed-${fs.crewId}-${date}`,
          date,
          crewId: fs.crewId,
          startTime: fs.startTime,
          endTime: fs.endTime,
          createdBy: "fixed",
          source: "fixed",
        });
      }
    }
  }

  return [...explicitView, ...derived].sort(
    (a, b) => a.date.localeCompare(b.date) || a.crewId.localeCompare(b.crewId),
  );
}
