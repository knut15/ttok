import { describe, it, expect, beforeEach } from "vitest";
import { __resetStore, getRecord, updateStatus, upsertTodayClock } from "./store";
import { calcPaidMinutes, calcDailyPay } from "./pay";
import { HOURLY_WAGE, DEFAULT_BREAK_MINUTES, REGULAR_MINUTES } from "./constants";

const VACATION_DATE = "2026-05-29"; // 시드상 휴가

beforeEach(() => {
  __resetStore();
});

describe("upsertTodayClock — 휴가일 토글(버그1)", () => {
  it("휴가일에 clockIn/clockOut 기록 시 status가 '정상'으로 전환되고 급여가 0원이 아니다", () => {
    upsertTodayClock(VACATION_DATE, "clockIn", "08:00");
    const rec = upsertTodayClock(VACATION_DATE, "clockOut", "15:00");

    expect(rec.status).toBe("정상");
    expect(rec.breakMinutes).toBe(DEFAULT_BREAK_MINUTES);
    expect(rec.workMinutes).toBe(390);
    expect(rec.deductMinutes).toBe(0);

    const paid = calcPaidMinutes({
      workMinutes: rec.workMinutes,
      deductMinutes: rec.deductMinutes,
      status: rec.status,
    });
    const pay = calcDailyPay({ paidMinutes: paid, hourlyWage: HOURLY_WAGE, status: rec.status });
    expect(pay).toBeGreaterThan(0);
  });

  it("clockIn 기록만으로도 휴가 status가 '정상'으로 전환되고 휴게가 정상화된다", () => {
    const rec = upsertTodayClock(VACATION_DATE, "clockIn", "08:00");
    expect(rec.status).toBe("정상");
    expect(rec.breakMinutes).toBe(DEFAULT_BREAK_MINUTES);
  });
});

describe("updateStatus — 상태 전환 시 연산 필드 재계산(버그2)", () => {
  it("'정상'→'휴가' 전환 시 work/overtime/deduct 모두 0", () => {
    const target = "2026-05-26"; // 시드 정상 390분
    const rec = updateStatus(target, "휴가");
    expect(rec).not.toBeNull();
    expect(rec!.status).toBe("휴가");
    expect(rec!.workMinutes).toBe(0);
    expect(rec!.overtimeMinutes).toBe(0);
    expect(rec!.deductMinutes).toBe(0);
  });

  // AC-T3-1: 결근 = 정규 전액 차감. deduct=REGULAR_MINUTES(390), work/overtime/break=0, clock 보존.
  it("'결근'으로 전환 시 정규 전액 차감(deduct=390)·work/overtime/break=0·clock 보존", () => {
    const target = "2026-05-26"; // 시드 정상 08:00~15:00
    const rec = updateStatus(target, "결근");
    expect(rec!.status).toBe("결근");
    expect(rec!.deductMinutes).toBe(REGULAR_MINUTES); // 390 전액 차감
    expect(rec!.workMinutes).toBe(0);
    expect(rec!.overtimeMinutes).toBe(0);
    expect(rec!.breakMinutes).toBe(0);
    expect(rec!.clockIn).toBe("08:00"); // 보존
    expect(rec!.clockOut).toBe("15:00"); // 보존
  });

  it("'휴가'→'정상'(clock 존재) 전환 시 workMinutes/overtime 재계산", () => {
    // 5/29 휴가일에 토글로 clock 부여 후 휴가로 되돌렸다가 다시 정상으로
    upsertTodayClock(VACATION_DATE, "clockIn", "08:00");
    upsertTodayClock(VACATION_DATE, "clockOut", "17:00");
    updateStatus(VACATION_DATE, "휴가"); // 인정시간 0으로
    expect(getRecord(VACATION_DATE)!.workMinutes).toBe(0);

    const rec = updateStatus(VACATION_DATE, "정상");
    expect(rec!.workMinutes).toBe(510); // 08:00~17:00 - 30
    expect(rec!.overtimeMinutes).toBe(120);
  });

  it("'지각'→'지각'(상태 유지 재계산) 시 deductMinutes는 기존값 보존(임의추정 금지)", () => {
    const target = "2026-05-13"; // 시드 지각, deduct 50
    // 지각 상태를 유지한 채 재계산해도 기존 deduct(50) 보존.
    const rec = updateStatus(target, "지각");
    expect(rec!.deductMinutes).toBe(50);
  });

  it("없는 날짜는 null", () => {
    expect(updateStatus("2099-01-01", "정상")).toBeNull();
  });

  // REWORK v3 #2: 지각(deduct>0)→정상 전환 시 차감 해소
  it("'지각'(deduct=90)→'정상' 전환 시 deductMinutes가 0으로 해소된다", () => {
    const target = "2026-05-05"; // 시드 지각, deduct 90
    expect(getRecord(target)!.deductMinutes).toBe(90);
    const rec = updateStatus(target, "정상");
    expect(rec!.status).toBe("정상");
    expect(rec!.deductMinutes).toBe(0);
  });

  it("'지각'(deduct=90)→'연장' 전환 시에도 deductMinutes가 0", () => {
    const rec = updateStatus("2026-05-05", "연장");
    expect(rec!.deductMinutes).toBe(0);
  });

  // REWORK v3 #3: 휴가/결근 전환 시 breakMinutes 초기화
  it("'정상'→'휴가' 전환 시 breakMinutes가 0으로 초기화된다", () => {
    const target = "2026-05-26"; // 시드 정상, break 30
    expect(getRecord(target)!.breakMinutes).toBe(DEFAULT_BREAK_MINUTES);
    const rec = updateStatus(target, "휴가");
    expect(rec!.breakMinutes).toBe(0);
  });

  it("'정상'→'결근' 전환 시에도 breakMinutes가 0", () => {
    const rec = updateStatus("2026-05-26", "결근");
    expect(rec!.breakMinutes).toBe(0);
  });

  // REWORK v3 #3: 휴가→정상 역전환 시 break 복원 + work 재계산(과대산정 방지)
  it("'휴가'→'정상'(clock 존재) 역전환 시 breakMinutes가 복원되고 work가 과대산정되지 않는다", () => {
    const target = "2026-05-26"; // 08:00~15:00, work 390, break 30
    updateStatus(target, "휴가"); // break=0, work=0
    expect(getRecord(target)!.breakMinutes).toBe(0);

    const rec = updateStatus(target, "정상");
    // break 가 복원되지 않으면 work=420(과대), 복원되면 390.
    expect(rec!.breakMinutes).toBe(DEFAULT_BREAK_MINUTES);
    expect(rec!.workMinutes).toBe(390);
    expect(rec!.overtimeMinutes).toBe(0);
  });
});
