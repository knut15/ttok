import { describe, it, expect } from "vitest";
import { formatBadge, clockPhase, clockRangeLabel } from "./domain";
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
