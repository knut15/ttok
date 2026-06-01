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
import { isWeekendDate } from "./schedule";

beforeEach(() => __resetStore());

describe("고정 근무 store 접근자", () => {
  it("시드 고정근무: 김민정 평일, 이서연 주말", () => {
    const fixed = listFixedShifts();
    expect(fixed.some((f) => f.crewId === DEFAULT_CREW_ID && f.dayType === "weekday")).toBe(true);
    expect(fixed.some((f) => f.crewId === "crew-2" && f.dayType === "weekend")).toBe(true);
  });

  it("setFixedShift upsert: (crewId, dayType) 당 1건, 시간 갱신", () => {
    setFixedShift({ crewId: "crew-3", dayType: "weekday", startTime: "10:00", endTime: "14:00" });
    setFixedShift({ crewId: "crew-3", dayType: "weekday", startTime: "11:00", endTime: "15:00" });
    const list = listFixedShifts().filter((f) => f.crewId === "crew-3" && f.dayType === "weekday");
    expect(list).toHaveLength(1);
    expect(list[0].startTime).toBe("11:00");
  });

  it("removeFixedShift 해제", () => {
    expect(removeFixedShift(DEFAULT_CREW_ID, "weekday")).toBe(true);
    expect(listFixedShifts().some((f) => f.crewId === DEFAULT_CREW_ID && f.dayType === "weekday")).toBe(false);
    expect(removeFixedShift(DEFAULT_CREW_ID, "weekday")).toBe(false);
  });
});

describe("getMonthScheduleView — 명시 배정 + 고정근무 병합", () => {
  it("고정근무가 평일에 자동 적용된다(source=fixed)", () => {
    // 2026-06-02 화(평일) 김민정 명시 배정 없으면 고정 08:00~11:00 자동 적용.
    __resetStore();
    // 김민정의 6월 명시 배정을 모두 제거하기 위해 새 store 에서 view 확인 — 단, 시드 6월에 일부 명시 존재.
    const view = getMonthScheduleView("2026-06");
    const fixedDerived = view.filter(
      (e) => e.crewId === DEFAULT_CREW_ID && e.source === "fixed",
    );
    expect(fixedDerived.length).toBeGreaterThan(0);
    // 평일 파생은 08:00~11:00
    expect(fixedDerived.every((e) => e.startTime === "08:00" && e.endTime === "11:00")).toBe(true);
  });

  it("같은 날 명시 배정이 있으면 고정근무는 생략(명시 우선)", () => {
    const date = "2026-06-02"; // 화(평일)
    upsertSchedule({ date, crewId: DEFAULT_CREW_ID, startTime: "13:00", endTime: "18:00", createdBy: MASTER_ID });
    const view = getMonthScheduleView("2026-06");
    const forDay = view.filter((e) => e.date === date && e.crewId === DEFAULT_CREW_ID);
    expect(forDay).toHaveLength(1);
    expect(forDay[0].source).toBe("manual");
    expect(forDay[0].startTime).toBe("13:00");
  });

  it("주말 고정근무(crew-2)는 주말 날짜에만 파생된다", () => {
    const view = getMonthScheduleView("2026-06");
    const crew2Fixed = view.filter((e) => e.crewId === "crew-2" && e.source === "fixed");
    expect(crew2Fixed.length).toBeGreaterThan(0);
    expect(crew2Fixed.every((e) => isWeekendDate(e.date))).toBe(true);
    expect(crew2Fixed.every((e) => e.startTime === "11:00" && e.endTime === "17:00")).toBe(true);
  });
});
