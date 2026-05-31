import { describe, it, expect } from "vitest";
import {
  calcWorkMinutes,
  calcOvertime,
  calcOvertimeByClock,
  calcBreakMinutes,
  formatHHMM,
  parseHHMM,
} from "./time";

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

// 연장 정합(G2, ADR 0001): 연장 = max(0, parseHHMM(clockOut) − 900). clockIn 무관.
describe("calcOvertimeByClock — 정시 퇴근(900분) 초과분만 연장", () => {
  // AC-5 / E-6: 조기출근·정시퇴근 → 연장 0 (work 392여도)
  it("07:58 출근·15:00 퇴근(조기출근·정시퇴근)이어도 연장 0", () => {
    expect(calcOvertimeByClock({ clockOut: "15:00" })).toBe(0);
  });

  // AC-6: 08:00~16:30 → 990−900 = 90
  it("16:30 퇴근이면 연장 90(990−900)", () => {
    expect(calcOvertimeByClock({ clockOut: "16:30" })).toBe(90);
  });

  // AC-7: IMG_3609 5/05 정시퇴근 변형 → 0
  it("15:00 정시 퇴근이면 연장 0 (clockIn 무관)", () => {
    expect(calcOvertimeByClock({ clockOut: "15:00" })).toBe(0);
  });

  // AC-7: 15:34 → 934−900 = 34
  it("15:34 퇴근이면 연장 34(934−900)", () => {
    expect(calcOvertimeByClock({ clockOut: "15:34" })).toBe(34);
  });

  // E-7: 17:00 → 1020−900 = 120
  it("17:00 연장퇴근이면 연장 120(1020−900)", () => {
    expect(calcOvertimeByClock({ clockOut: "17:00" })).toBe(120);
  });

  // E-6: 조기 퇴근(14:00) → 0
  it("14:00 조기퇴근이면 연장 0", () => {
    expect(calcOvertimeByClock({ clockOut: "14:00" })).toBe(0);
  });

  // E-4 / E-8: clockOut null 또는 형식 불량 → 0
  it("clockOut 이 null 이면 연장 0", () => {
    expect(calcOvertimeByClock({ clockOut: null })).toBe(0);
  });
  it("clockOut 형식이 불량하면(NaN) 연장 0", () => {
    expect(calcOvertimeByClock({ clockOut: "bad" })).toBe(0);
  });
});

// T7 휴게 범위 → 분 파생 (architect §2.2/§3.1). 순수 O(1), 역전/NaN 방어.
describe("calcBreakMinutes — 휴게 범위(HH:MM~HH:MM) → 분 파생", () => {
  it("11:30~12:00 이면 30분을 반환한다", () => {
    expect(calcBreakMinutes({ breakStart: "11:30", breakEnd: "12:00" })).toBe(
      30,
    );
  });

  it("역전(12:00~11:30)이면 0을 반환한다(fallback 기본 0)", () => {
    expect(calcBreakMinutes({ breakStart: "12:00", breakEnd: "11:30" })).toBe(
      0,
    );
  });

  it("동일 시각(11:30~11:30)이면 0을 반환한다", () => {
    expect(calcBreakMinutes({ breakStart: "11:30", breakEnd: "11:30" })).toBe(
      0,
    );
  });

  it("형식 불량(NaN)이면 0을 반환한다", () => {
    expect(calcBreakMinutes({ breakStart: "bad", breakEnd: "12:00" })).toBe(0);
    expect(calcBreakMinutes({ breakStart: "11:30", breakEnd: "99:99" })).toBe(
      0,
    );
  });

  it("범위 한쪽이 없으면 fallback 을 반환한다(범위 미명시 하위호환)", () => {
    expect(
      calcBreakMinutes({ breakStart: "11:30", breakEnd: null, fallback: 30 }),
    ).toBe(30);
    expect(calcBreakMinutes({ fallback: 45 })).toBe(45);
  });
});
