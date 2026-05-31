import { describe, it, expect } from "vitest";
import { formatBadge } from "./domain";
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
