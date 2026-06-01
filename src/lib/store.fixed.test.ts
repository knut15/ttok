import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetStore,
  listFixedShifts,
  setFixedShift,
  removeFixedShift,
  getMonthScheduleView,
  upsertSchedule,
} from "./store";
import { DEFAULT_CREW_ID, MASTER_ID } from "./constants";
import { getWeekdayIndex } from "./schedule";

beforeEach(() => __resetStore());

describe("고정 근무 store 접근자 (요일 선택)", () => {
  it("시드 고정근무: 김민정 일~목, 이서연 금·토", () => {
    const fixed = listFixedShifts();
    const minjung = fixed.find((f) => f.crewId === DEFAULT_CREW_ID);
    const seoyeon = fixed.find((f) => f.crewId === "crew-2");
    expect(minjung?.weekdays).toEqual([0, 1, 2, 3, 4]);
    expect(seoyeon?.weekdays).toEqual([5, 6]);
  });

  it("setFixedShift upsert: crewId 당 1건, 요일/시간 갱신 + 중복요일 정렬", () => {
    setFixedShift({ crewId: "crew-3", weekdays: [3, 1], startTime: "10:00", endTime: "14:00" });
    setFixedShift({ crewId: "crew-3", weekdays: [2, 2, 5], startTime: "11:00", endTime: "15:00" });
    const list = listFixedShifts().filter((f) => f.crewId === "crew-3");
    expect(list).toHaveLength(1);
    expect(list[0].weekdays).toEqual([2, 5]); // 중복 제거 + 정렬
    expect(list[0].startTime).toBe("11:00");
  });

  it("removeFixedShift(crewId) 해제", () => {
    expect(removeFixedShift(DEFAULT_CREW_ID)).toBe(true);
    expect(listFixedShifts().some((f) => f.crewId === DEFAULT_CREW_ID)).toBe(false);
    expect(removeFixedShift(DEFAULT_CREW_ID)).toBe(false);
  });
});

describe("getMonthScheduleView — 명시 배정 + 고정근무 병합", () => {
  it("고정근무가 선택 요일에 자동 적용된다(source=fixed)", () => {
    const view = getMonthScheduleView("2026-06");
    const fixedDerived = view.filter(
      (e) => e.crewId === DEFAULT_CREW_ID && e.source === "fixed",
    );
    expect(fixedDerived.length).toBeGreaterThan(0);
    // 김민정 고정 요일은 일~목 → 금/토엔 파생 없음
    expect(fixedDerived.every((e) => [0, 1, 2, 3, 4].includes(getWeekdayIndex(e.date)))).toBe(true);
    expect(fixedDerived.every((e) => e.startTime === "08:00" && e.endTime === "11:00")).toBe(true);
  });

  it("같은 날 명시 배정이 있으면 고정근무는 생략(명시 우선)", () => {
    const date = "2026-06-02"; // 화(고정 요일)
    upsertSchedule({ date, crewId: DEFAULT_CREW_ID, startTime: "13:00", endTime: "18:00", createdBy: MASTER_ID });
    const forDay = getMonthScheduleView("2026-06").filter(
      (e) => e.date === date && e.crewId === DEFAULT_CREW_ID,
    );
    expect(forDay).toHaveLength(1);
    expect(forDay[0].source).toBe("manual");
    expect(forDay[0].startTime).toBe("13:00");
  });

  it("이서연 고정(금·토)은 금·토 날짜에만 파생된다", () => {
    const crew2Fixed = getMonthScheduleView("2026-06").filter(
      (e) => e.crewId === "crew-2" && e.source === "fixed",
    );
    expect(crew2Fixed.length).toBeGreaterThan(0);
    expect(crew2Fixed.every((e) => [5, 6].includes(getWeekdayIndex(e.date)))).toBe(true);
  });
});

describe("대타(substitute) 판정 — 요일 기반", () => {
  const TUESDAY = "2026-06-02"; // 화(김민정 고정 요일)
  const FRIDAY = "2026-06-05"; // 금(김민정 고정 요일 아님: 일~목)

  it("고정 요일이 아닌 날 근무 투입 → 대타", () => {
    // 김민정은 일~목 고정 → 금요일 근무는 대타
    upsertSchedule({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00", createdBy: MASTER_ID });
    const e = getMonthScheduleView("2026-06").find((x) => x.date === FRIDAY && x.crewId === DEFAULT_CREW_ID);
    expect(e?.substitute).toBe(true);
  });

  it("고정 요일의 변동 배정은 대타 아님", () => {
    upsertSchedule({ date: TUESDAY, crewId: DEFAULT_CREW_ID, startTime: "13:00", endTime: "18:00", createdBy: MASTER_ID });
    const e = getMonthScheduleView("2026-06").find((x) => x.date === TUESDAY && x.crewId === DEFAULT_CREW_ID);
    expect(e?.substitute).toBe(false);
  });

  it("고정근무 자동적용(fixed)은 대타가 아니다", () => {
    const fixedEntries = getMonthScheduleView("2026-06").filter((e) => e.source === "fixed");
    expect(fixedEntries.every((e) => e.substitute !== true)).toBe(true);
  });

  it("휴무는 대타 아님", () => {
    upsertSchedule({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "00:00", endTime: "00:00", off: true, createdBy: MASTER_ID });
    const e = getMonthScheduleView("2026-06").find((x) => x.date === FRIDAY && x.crewId === DEFAULT_CREW_ID);
    expect(e?.substitute).toBe(false);
  });
});
