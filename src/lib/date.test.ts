import { describe, it, expect } from "vitest";
import {
  isValidDateString,
  formatDotDate,
  buildMonthGrid,
  formatBirthDate,
  shiftMonth,
  shiftDay,
  monthsBetween,
  todayDate,
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

// 일자 ±N 이동 — 월/연/윤년 경계 + 포맷 보존(AC-1~5, E1~E3)
describe("shiftDay", () => {
  it("AC-1 같은 달 안에서 ±1: 2026-05-29 → 30 / 28", () => {
    expect(shiftDay("2026-05-29", 1)).toBe("2026-05-30");
    expect(shiftDay("2026-05-29", -1)).toBe("2026-05-28");
  });
  it("AC-2 월 경계: 2026-05-31 +1 → 2026-06-01, 2026-06-01 -1 → 2026-05-31", () => {
    expect(shiftDay("2026-05-31", 1)).toBe("2026-06-01");
    expect(shiftDay("2026-06-01", -1)).toBe("2026-05-31");
  });
  it("AC-3 연 경계: 2026-12-31 +1 → 2027-01-01, 2026-01-01 -1 → 2025-12-31", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("AC-4 윤년 2월: 2028-02-28 +1 → 02-29, 2028-03-01 -1 → 02-29", () => {
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("AC-4 비윤년 2월: 2026-02-28 +1 → 2026-03-01", () => {
    expect(shiftDay("2026-02-28", 1)).toBe("2026-03-01");
  });
  it("AC-5 포맷 보존(zero-pad) 및 항등: 2026-01-05 -4 → 2026-01-01, +0 항등", () => {
    expect(shiftDay("2026-01-05", -4)).toBe("2026-01-01");
    expect(shiftDay("2026-05-31", 0)).toBe("2026-05-31");
  });
});

// 입사월~현재월 오름차순 "YYYY-MM" 목록(S3 월 picker 범위, Q1)
describe("monthsBetween", () => {
  it("데모 범위 2026-04~2026-05 → [2026-04, 2026-05]", () => {
    expect(monthsBetween("2026-04", "2026-05")).toEqual(["2026-04", "2026-05"]);
  });
  it("단일 월(start===end) → [그 월]", () => {
    expect(monthsBetween("2026-05", "2026-05")).toEqual(["2026-05"]);
  });
  it("연 경계 횡단: 2025-11~2026-02 → 4개월", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
  it("start > end 면 빈 배열(역전 방어)", () => {
    expect(monthsBetween("2026-06", "2026-05")).toEqual([]);
  });
});

// 로컬 기준 오늘 "YYYY-MM-DD" — Date 주입으로 결정적 검증(AC-T6-1)
describe("todayDate (AC-T6-1)", () => {
  it("month 0-index 변환: new Date(2026,4,31) → 2026-05-31 (4=5월)", () => {
    expect(todayDate(new Date(2026, 4, 31))).toBe("2026-05-31");
  });
  it("연초: new Date(2026,0,1) → 2026-01-01", () => {
    expect(todayDate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
  it("zero-pad: new Date(2026,11,9) → 2026-12-09", () => {
    expect(todayDate(new Date(2026, 11, 9))).toBe("2026-12-09");
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
