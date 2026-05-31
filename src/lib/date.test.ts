import { describe, it, expect } from "vitest";
import { isValidDateString, formatDotDate, buildMonthGrid } from "./date";

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

describe("buildMonthGrid", () => {
  it("2026-05 는 1일이 금요일이므로 앞 5칸 공백 + 31일", () => {
    const cells = buildMonthGrid("2026-05");
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(cells[5]).toBe("2026-05-01");
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
  });
});
