import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetStore,
  getRecord,
  updateStatus,
  upsertTodayClock,
  addRequest,
  approveRequest,
} from "./store";
import { calcPaidMinutes, calcDailyPay } from "./pay";
import { HOURLY_WAGE, DEFAULT_BREAK_MINUTES, REGULAR_MINUTES } from "./constants";
import type { EditRequestChange } from "@/types";

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

// 수정요청 수락 반영(AC-1~4, E-1~4). Q1 upsert / Q2 멱등 no-op.
function pending(date: string, after: EditRequestChange) {
  return addRequest({ date, reason: "정정 요청", after });
}

describe("approveRequest — 수락 반영", () => {
  // AC-1 / AC-2 / AC-3: after 반영 + status 전이 + work/overtime 재계산
  it("대기 요청 수락 시 레코드에 after 가 반영되고 status가 대기→수락으로 전이한다", () => {
    const date = "2026-05-04";
    const req = pending(date, {
      status: "연장",
      clockIn: "07:26",
      clockOut: "15:34",
    });
    const result = approveRequest(req.id);

    expect(result).not.toBeNull();
    // AC-2: 요청 status 전이
    expect(result!.request.status).toBe("수락");
    // AC-1: 레코드 after 반영
    expect(result!.record.status).toBe("연장");
    expect(result!.record.clockIn).toBe("07:26");
    expect(result!.record.clockOut).toBe("15:34");
    // store 진실원에도 반영
    expect(getRecord(date)!.clockOut).toBe("15:34");
  });

  // AC-3 / AC-7: workMinutes 재계산 + 연장 정합(clockOut 15:34 → 34)
  it("정상/연장 after 는 workMinutes 재계산 + overtime=clockOut 초과분(15:34→34)", () => {
    const req = pending("2026-05-04", {
      status: "연장",
      clockIn: "07:26",
      clockOut: "15:34",
    });
    const { record } = approveRequest(req.id)!;
    // 07:26~15:34 - 30 = 488 - 30 = 458
    expect(record.workMinutes).toBe(458);
    expect(record.overtimeMinutes).toBe(34);
  });

  // AC-5 / 연장 정합: 조기출근·정시퇴근(07:58~15:00) → work 392여도 overtime 0
  it("조기출근·정시퇴근(07:58~15:00) 수락 시 work 392·overtime 0 (조기출근 연장 아님)", () => {
    const req = pending("2026-05-28", {
      status: "정상",
      clockIn: "07:58",
      clockOut: "15:00",
    });
    const { record } = approveRequest(req.id)!;
    expect(record.workMinutes).toBe(392); // 07:58~15:00 - 30
    expect(record.overtimeMinutes).toBe(0);
  });

  // AC-2: 다른 요청은 불변
  it("수락 시 다른 대기 요청의 status는 불변", () => {
    const a = pending("2026-05-04", {
      status: "정상",
      clockIn: "08:00",
      clockOut: "15:00",
    });
    const b = pending("2026-05-06", {
      status: "정상",
      clockIn: "08:00",
      clockOut: "15:00",
    });
    approveRequest(a.id);
    // b 는 store 에서 여전히 대기
    expect(approveRequest(b.id)!.request.id).toBe(b.id);
  });

  // E-1: 없는 id → null
  it("존재하지 않는 요청 id 는 null 을 반환하고 store 를 변경하지 않는다", () => {
    expect(approveRequest("req-999")).toBeNull();
  });

  // AC-4: 결근 after → deduct=390, work/overtime/break=0
  it("after.status=결근 수락 시 결근 차감 정책(deduct=390·work/overtime/break=0) 적용", () => {
    const req = pending("2026-05-26", {
      status: "결근",
      clockIn: "08:00",
      clockOut: "15:00",
    });
    const { record } = approveRequest(req.id)!;
    expect(record.status).toBe("결근");
    expect(record.deductMinutes).toBe(REGULAR_MINUTES);
    expect(record.workMinutes).toBe(0);
    expect(record.overtimeMinutes).toBe(0);
    expect(record.breakMinutes).toBe(0);
  });

  // AC-4: 휴가 after → deduct=0, work/overtime/break=0
  it("after.status=휴가 수락 시 휴가 차감 정책(deduct=0·work/overtime/break=0) 적용", () => {
    const req = pending("2026-05-26", {
      status: "휴가",
      clockIn: null,
      clockOut: null,
    });
    const { record } = approveRequest(req.id)!;
    expect(record.status).toBe("휴가");
    expect(record.deductMinutes).toBe(0);
    expect(record.workMinutes).toBe(0);
    expect(record.overtimeMinutes).toBe(0);
    expect(record.breakMinutes).toBe(0);
  });

  // E-2: 멱등 no-op — 이미 수락이면 재반영 안 함
  it("이미 수락된 요청 재수락은 멱등 no-op(레코드 불변·status 수락 유지)", () => {
    const date = "2026-05-04";
    const req = pending(date, {
      status: "연장",
      clockIn: "07:26",
      clockOut: "15:34",
    });
    approveRequest(req.id);
    const after1 = getRecord(date)!;
    const result2 = approveRequest(req.id)!;
    expect(result2.request.status).toBe("수락");
    // 레코드 재반영(이중계산) 없음 — work/overtime 동일
    expect(result2.record.workMinutes).toBe(after1.workMinutes);
    expect(result2.record.overtimeMinutes).toBe(after1.overtimeMinutes);
  });

  // E-3 / Q1: 레코드 없는 날 수락 → after 로 신규 레코드 생성(upsert)
  it("레코드 없는 날(시드 외) 수락 시 after 로 신규 레코드를 생성한다(upsert)", () => {
    const date = "2026-07-15"; // 시드 외
    expect(getRecord(date)).toBeNull();
    const req = pending(date, {
      status: "정상",
      clockIn: "08:00",
      clockOut: "16:30",
    });
    const { record } = approveRequest(req.id)!;
    expect(getRecord(date)).not.toBeNull();
    expect(record.clockOut).toBe("16:30");
    expect(record.workMinutes).toBe(480); // 08:00~16:30 - 30
    expect(record.overtimeMinutes).toBe(90); // 16:30 → 990−900
  });
});
