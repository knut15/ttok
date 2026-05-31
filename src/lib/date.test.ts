import { describe, it, expect } from "vitest";
import {
  isValidDateString,
  formatDotDate,
  buildMonthGrid,
  formatBirthDate,
  shiftMonth,
} from "./date";

describe("isValidDateString (엣지#5)", () => {
  it("유효한 날짜는 true", () => {
    expect(isValidDateString("2026-05-28")).toBe(true);
  });
  it("형식/범위 불량은 false", () => {
    expect(isValidDateString("2026-05-99")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("not-a-date")).toBe(false);
  });
});

describe("formatDotDate (AC-11)", () => {
  it("2026-05-29 → 2026.05.29 금", () => {
    expect(formatDotDate("2026-05-29")).toBe("2026.05.29 금");
  });
});

describe("formatBirthDate (AC-12 — 요일 없음)", () => {
  it("1986-04-06 → 1986년 4월 6일", () => {
    expect(formatBirthDate("1986-04-06")).toBe("1986년 4월 6일");
  });
});

// 월 ±1 이동 — 연/월 경계 처리(AC-10, E-10)
describe("shiftMonth", () => {
  it("같은 해 안에서 +1: 2026-05 → 2026-06", () => {
    expect(shiftMonth("2026-05", 1)).toBe("2026-06");
  });
  it("같은 해 안에서 -1: 2026-05 → 2026-04", () => {
    expect(shiftMonth("2026-05", -1)).toBe("2026-04");
  });
  it("연말 경계 +1: 2026-12 → 2027-01", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("연초 경계 -1: 2026-01 → 2025-12", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("buildMonthGrid", () => {
  it("2026-05 는 1일이 금요일이므로 앞 5칸 공백 + 31일", () => {
    const cells = buildMonthGrid("2026-05");
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(cells[5]).toBe("2026-05-01");
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
  });
});
