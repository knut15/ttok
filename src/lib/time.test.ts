import { describe, it, expect } from "vitest";
import { calcWorkMinutes, calcOvertime, formatHHMM, parseHHMM } from "./time";

describe("parseHHMM 범위 검증", () => {
  it("정상 경계 23:59 → 1439", () => {
    expect(parseHHMM("23:59")).toBe(1439);
  });
  it("정상 경계 00:00 → 0", () => {
    expect(parseHHMM("00:00")).toBe(0);
  });
  // 버그3: 99:99 같이 범위 초과 시 NaN (급여 과다산정 방지)
  it("시/분 범위 초과면 NaN (99:99)", () => {
    expect(parseHHMM("99:99")).toBeNaN();
  });
  it("시 24 이상이면 NaN (24:00)", () => {
    expect(parseHHMM("24:00")).toBeNaN();
  });
  it("분 60 이상이면 NaN (12:60)", () => {
    expect(parseHHMM("12:60")).toBeNaN();
  });
  it("형식 불량은 기존대로 NaN", () => {
    expect(parseHHMM("bad")).toBeNaN();
  });
});

describe("calcWorkMinutes", () => {
  // AC-1
  it("08:00~15:00 휴게 30분이면 390분(6시간30분)을 반환한다", () => {
    expect(
      calcWorkMinutes({ clockIn: "08:00", clockOut: "15:00", breakMinutes: 30 }),
    ).toBe(390);
  });
});

describe("calcWorkMinutes 방어", () => {
  // 엣지#4: clockOut < clockIn (역전) → 음수 방지, 0 반환
  it("퇴근이 출근보다 빠르면 0을 반환한다", () => {
    expect(
      calcWorkMinutes({ clockIn: "15:00", clockOut: "08:00", breakMinutes: 30 }),
    ).toBe(0);
  });

  // 형식 불량 → 0 (NaN 전파 방지)
  it("형식이 불량하면 0을 반환한다", () => {
    expect(
      calcWorkMinutes({ clockIn: "bad", clockOut: "15:00", breakMinutes: 30 }),
    ).toBe(0);
  });
});

describe("formatHHMM", () => {
  it("분을 HH:MM 문자열로 변환한다", () => {
    expect(formatHHMM(480)).toBe("08:00");
    expect(formatHHMM(905)).toBe("15:05");
  });
});

describe("calcOvertime", () => {
  // AC-4: clockOut 17:00, break 30분 → work 510, overtime 120(2시간)
  it("정규(390분) 초과분을 연장으로 분리한다", () => {
    const work = calcWorkMinutes({
      clockIn: "08:00",
      clockOut: "17:00",
      breakMinutes: 30,
    });
    expect(work).toBe(510);
    expect(calcOvertime(work)).toBe(120);
  });
});
