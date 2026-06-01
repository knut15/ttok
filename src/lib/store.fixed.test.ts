import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetStore,
  listFixedShifts,
  addFixedShift,
  removeFixedShift,
  crewFixedWeekdays,
  getMonthScheduleView,
  upsertSchedule,
} from "./store";
import { DEFAULT_CREW_ID, MASTER_ID } from "./constants";
import { getWeekdayIndex } from "./schedule";

beforeEach(() => __resetStore());

describe("고정 근무 블록 store 접근자 (크루당 여러 블록)", () => {
  it("시드: 김민정 2블록(월~목, 일), 이서연 1블록(금·토)", () => {
    const all = listFixedShifts();
    const minjung = all.filter((f) => f.crewId === DEFAULT_CREW_ID);
    expect(minjung).toHaveLength(2);
    expect(minjung.map((b) => b.weekdays)).toEqual([[0], [1, 2, 3, 4]]); // 시작요일 순 정렬
    const seoyeon = all.filter((f) => f.crewId === "crew-2");
    expect(seoyeon).toHaveLength(1);
    expect(seoyeon[0].weekdays).toEqual([5, 6]);
  });

  it("addFixedShift: 새 블록을 id 와 함께 추가(요일 정규화)", () => {
    const b = addFixedShift({ crewId: "crew-3", weekdays: [3, 1, 1], startTime: "10:00", endTime: "14:00" });
    expect(b.id).toMatch(/^fix-/);
    expect(b.weekdays).toEqual([1, 3]); // 중복 제거 + 정렬
    expect(listFixedShifts().some((f) => f.id === b.id)).toBe(true);
  });

  it("removeFixedShift(id): 블록 삭제", () => {
    const minjung = listFixedShifts().filter((f) => f.crewId === DEFAULT_CREW_ID);
    expect(removeFixedShift(minjung[0].id)).toBe(true);
    expect(listFixedShifts().filter((f) => f.crewId === DEFAULT_CREW_ID)).toHaveLength(1);
    expect(removeFixedShift("nope")).toBe(false);
  });

  it("crewFixedWeekdays: 크루의 전 블록 요일 합집합", () => {
    expect([...crewFixedWeekdays(DEFAULT_CREW_ID)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("getMonthScheduleView — 블록별 시간 자동적용", () => {
  it("김민정: 월~목 08:00~11:00, 일 10:00~14:00 (요일별 시간 다름)", () => {
    const fixed = getMonthScheduleView("2026-06").filter(
      (e) => e.crewId === DEFAULT_CREW_ID && e.source === "fixed",
    );
    const sun = fixed.filter((e) => getWeekdayIndex(e.date) === 0);
    const monThu = fixed.filter((e) => [1, 2, 3, 4].includes(getWeekdayIndex(e.date)));
    expect(sun.length).toBeGreaterThan(0);
    expect(monThu.length).toBeGreaterThan(0);
    expect(sun.every((e) => e.startTime === "10:00" && e.endTime === "14:00")).toBe(true);
    expect(monThu.every((e) => e.startTime === "08:00" && e.endTime === "11:00")).toBe(true);
    // 금·토엔 김민정 파생 없음
    expect(fixed.every((e) => [0, 1, 2, 3, 4].includes(getWeekdayIndex(e.date)))).toBe(true);
  });
});

describe("대타(substitute) — 다중 블록 기준", () => {
  const FRIDAY = "2026-06-05"; // 금: 김민정 고정 요일 아님
  const SUNDAY = "2026-06-07"; // 일: 김민정 고정 요일(블록 B)

  it("어느 블록에도 없는 요일 근무 → 대타", () => {
    upsertSchedule({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00", createdBy: MASTER_ID });
    const e = getMonthScheduleView("2026-06").find((x) => x.date === FRIDAY && x.crewId === DEFAULT_CREW_ID);
    expect(e?.substitute).toBe(true);
  });

  it("어떤 블록의 요일이면 대타 아님(일요일 변동)", () => {
    upsertSchedule({ date: SUNDAY, crewId: DEFAULT_CREW_ID, startTime: "11:00", endTime: "15:00", createdBy: MASTER_ID });
    const e = getMonthScheduleView("2026-06").find((x) => x.date === SUNDAY && x.crewId === DEFAULT_CREW_ID);
    expect(e?.substitute).toBe(false);
  });
});
