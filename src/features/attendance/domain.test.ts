import { describe, it, expect } from "vitest";
import {
  formatBadge,
  clockPhase,
  clockRangeLabel,
  shouldShowPercent,
  canSubmitAddRecord,
  requestKindLabel,
} from "./domain";
import type { AttendanceRecord } from "@/types";

function rec(p: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    date: "2026-05-04",
    status: "정상",
    clockIn: "08:00",
    clockOut: "15:00",
    breakMinutes: 30,
    workMinutes: 390,
    overtimeMinutes: 0,
    deductMinutes: 0,
    ...p,
  };
}

describe("formatBadge (쟁점 A)", () => {
  it("정규 초과(연장)는 그린 +N분 배지", () => {
    expect(formatBadge(rec({ status: "연장", workMinutes: 424 }))).toEqual({
      text: "+34분",
      tone: "green",
    });
  });

  it("정규 대비 부족분은 회색 -N분 배지", () => {
    expect(formatBadge(rec({ workMinutes: 90 }))).toEqual({
      text: "-300분",
      tone: "gray",
    });
  });

  it("diff===0 이면 배지를 숨긴다(+0분 미표시)", () => {
    expect(formatBadge(rec({ workMinutes: 390 }))).toBeNull();
  });

  it("휴가는 배지 null(라벨 별도)", () => {
    expect(formatBadge(rec({ status: "휴가", workMinutes: 0 }))).toBeNull();
  });
});

describe("clockPhase (FAB/ClockToggle 공용 phase 인지, AC-3~5)", () => {
  it("레코드 없음(0건)이면 before(미출근)", () => {
    expect(clockPhase(null)).toBe("before");
  });

  it("clockIn 없으면 before", () => {
    expect(clockPhase(rec({ clockIn: null, clockOut: null }))).toBe("before");
  });

  it("clockIn 있고 clockOut 없으면 working(근무중)", () => {
    expect(clockPhase(rec({ clockIn: "08:00", clockOut: null }))).toBe(
      "working",
    );
  });

  it("clockIn·clockOut 모두 있으면 done(마감)", () => {
    expect(clockPhase(rec({ clockIn: "08:00", clockOut: "15:00" }))).toBe(
      "done",
    );
  });
});

describe("clockRangeLabel (T13: 홈 진행바 좌측 라벨)", () => {
  it("before(미출근)는 정규시간 placeholder", () => {
    expect(clockRangeLabel(null, "before")).toBe("08:00 ~ 15:00");
  });

  it("clockIn 없으면 정규 placeholder(phase 무관 방어)", () => {
    expect(clockRangeLabel(rec({ clockIn: null, clockOut: null }), "before")).toBe(
      "08:00 ~ 15:00",
    );
  });

  it("working(근무중)은 실제 출근시각 + 퇴근 미정", () => {
    expect(
      clockRangeLabel(rec({ clockIn: "14:30", clockOut: null }), "working"),
    ).toBe("14:30 ~");
  });

  it("done(마감)은 실제 출근~퇴근", () => {
    expect(
      clockRangeLabel(rec({ clockIn: "14:30", clockOut: "15:30" }), "done"),
    ).toBe("14:30 ~ 15:30");
  });
});

describe("shouldShowPercent (홈 진행바 우측 % 라벨: 퇴근 완료 후에만)", () => {
  it("done(퇴근 완료)이면 % 라벨 노출", () => {
    expect(shouldShowPercent("done")).toBe(true);
  });

  it("before(미출근)이면 % 라벨 미노출", () => {
    expect(shouldShowPercent("before")).toBe(false);
  });

  it("working(근무중)이면 % 라벨 미노출", () => {
    expect(shouldShowPercent("working")).toBe(false);
  });
});

describe("canSubmitAddRecord (T15 추가 폼 로컬 검증)", () => {
  // AC-3/E-3: 출근시각 필수 — 미입력이면 제출 불가
  it("출근시각이 비어있으면 제출 불가", () => {
    expect(canSubmitAddRecord({ status: "정상", clockIn: "", clockOut: "" })).toBe(false);
    expect(canSubmitAddRecord({ status: "정상", clockIn: "", clockOut: "15:00" })).toBe(false);
  });

  // Q2/E-6: 출근만 입력(퇴근 빈값)은 제출 가능(퇴근 선택, null 허용)
  it("출근만 입력(퇴근 빈값)은 제출 가능", () => {
    expect(canSubmitAddRecord({ status: "정상", clockIn: "08:00", clockOut: "" })).toBe(true);
  });

  // AC-11/Q5: 출근·퇴근 둘 다 있고 퇴근<=출근(역전·동일)이면 제출 불가
  it("퇴근이 출근보다 빠르면(역전) 제출 불가", () => {
    expect(canSubmitAddRecord({ status: "정상", clockIn: "09:00", clockOut: "08:00" })).toBe(
      false,
    );
  });
  it("퇴근이 출근과 동일하면 제출 불가", () => {
    expect(canSubmitAddRecord({ status: "정상", clockIn: "09:00", clockOut: "09:00" })).toBe(
      false,
    );
  });

  // AC-3: 출근·퇴근 둘 다 있고 퇴근>출근이면 제출 가능
  it("출근·퇴근 정상(퇴근>출근)이면 제출 가능", () => {
    expect(canSubmitAddRecord({ status: "정상", clockIn: "08:00", clockOut: "15:00" })).toBe(
      true,
    );
  });

  // E-3: 잘못된 시각 형식(NaN)은 제출 불가
  it("출근시각 형식이 올바르지 않으면 제출 불가", () => {
    expect(canSubmitAddRecord({ status: "정상", clockIn: "99:99", clockOut: "" })).toBe(false);
  });
  it("퇴근시각 형식이 올바르지 않으면 제출 불가", () => {
    expect(canSubmitAddRecord({ status: "정상", clockIn: "08:00", clockOut: "bad" })).toBe(
      false,
    );
  });

  // 무근무(휴가/결근): 시각 입력 없이도 즉시 제출 가능(isSettledStatus 스킵)
  it("휴가는 출퇴근 시각 없이 제출 가능", () => {
    expect(canSubmitAddRecord({ status: "휴가", clockIn: "", clockOut: "" })).toBe(true);
  });
  it("결근은 출퇴근 시각 없이 제출 가능", () => {
    expect(canSubmitAddRecord({ status: "결근", clockIn: "", clockOut: "" })).toBe(true);
  });

  // 조퇴는 무근무가 아님 — 정상과 동일하게 출근시각 필수
  it("조퇴는 출근시각이 비어있으면 제출 불가(무근무 아님)", () => {
    expect(canSubmitAddRecord({ status: "조퇴", clockIn: "", clockOut: "" })).toBe(false);
  });
  it("조퇴도 출근시각이 있으면 제출 가능", () => {
    expect(canSubmitAddRecord({ status: "조퇴", clockIn: "08:00", clockOut: "13:00" })).toBe(true);
  });
});

describe("requestKindLabel (T15 Q4 추가/수정 파생 라벨)", () => {
  // Q4: before 빈 스냅샷(정상·clockIn null·clockOut null) = 레코드 없던 날 → "추가"
  it("before 가 빈 스냅샷이면 '추가'", () => {
    expect(
      requestKindLabel({ status: "정상", clockIn: null, clockOut: null }),
    ).toBe("추가");
  });

  // Q4: before 에 기존 clock/상태가 있으면 → "수정"
  it("before 에 clockIn 이 있으면 '수정'", () => {
    expect(
      requestKindLabel({ status: "정상", clockIn: "08:00", clockOut: "15:00" }),
    ).toBe("수정");
  });
  it("before.status 가 정상이 아니면(휴가) '수정'", () => {
    expect(
      requestKindLabel({ status: "휴가", clockIn: null, clockOut: null }),
    ).toBe("수정");
  });
  it("before.clockOut 만 있어도 '수정'", () => {
    expect(
      requestKindLabel({ status: "정상", clockIn: null, clockOut: "15:00" }),
    ).toBe("수정");
  });
});
