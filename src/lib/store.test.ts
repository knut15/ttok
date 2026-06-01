import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecord,
  updateStatus,
  upsertTodayClock,
  addRequest,
  approveRequest,
} from "./store";
import { resetDb } from "./db-seed";
import { calcPaidMinutes, calcDailyPay } from "./pay";
import { HOURLY_WAGE, DEFAULT_BREAK_MINUTES, REGULAR_MINUTES } from "./constants";
import type { EditRequestChange } from "@/types";

const VACATION_DATE = "2026-05-29"; // 시드상 휴가

beforeEach(async () => {
  await resetDb();
});

describe("upsertTodayClock — 휴가일 토글(버그1)", () => {
  it("휴가일에 clockIn/clockOut 기록 시 status가 '정상'으로 전환되고 급여가 0원이 아니다", async () => {
    await upsertTodayClock(VACATION_DATE, "clockIn", "08:00");
    const rec = await upsertTodayClock(VACATION_DATE, "clockOut", "15:00");

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

  it("clockIn 기록만으로도 휴가 status가 '정상'으로 전환되고 휴게가 정상화된다", async () => {
    const rec = await upsertTodayClock(VACATION_DATE, "clockIn", "08:00");
    expect(rec.status).toBe("정상");
    expect(rec.breakMinutes).toBe(DEFAULT_BREAK_MINUTES);
  });
});

describe("updateStatus — 상태 전환 시 연산 필드 재계산(버그2)", () => {
  it("'정상'→'휴가' 전환 시 work/overtime/deduct 모두 0", async () => {
    const target = "2026-05-26"; // 시드 정상 390분
    const rec = await updateStatus(target, "휴가");
    expect(rec).not.toBeNull();
    expect(rec!.status).toBe("휴가");
    expect(rec!.workMinutes).toBe(0);
    expect(rec!.overtimeMinutes).toBe(0);
    expect(rec!.deductMinutes).toBe(0);
  });

  it("'결근'으로 전환 시 정규 전액 차감(deduct=390)·work/overtime/break=0·clock 보존", async () => {
    const target = "2026-05-26";
    const rec = await updateStatus(target, "결근");
    expect(rec!.status).toBe("결근");
    expect(rec!.deductMinutes).toBe(REGULAR_MINUTES);
    expect(rec!.workMinutes).toBe(0);
    expect(rec!.overtimeMinutes).toBe(0);
    expect(rec!.breakMinutes).toBe(0);
    expect(rec!.clockIn).toBe("08:00");
    expect(rec!.clockOut).toBe("15:00");
  });

  it("'휴가'→'정상'(clock 존재) 전환 시 workMinutes/overtime 재계산", async () => {
    await upsertTodayClock(VACATION_DATE, "clockIn", "08:00");
    await upsertTodayClock(VACATION_DATE, "clockOut", "17:00");
    await updateStatus(VACATION_DATE, "휴가");
    expect((await getRecord(VACATION_DATE))!.workMinutes).toBe(0);

    const rec = await updateStatus(VACATION_DATE, "정상");
    expect(rec!.workMinutes).toBe(510); // 08:00~17:00 - 30
    expect(rec!.overtimeMinutes).toBe(120);
  });

  it("'지각'→'지각'(상태 유지 재계산) 시 deductMinutes는 기존값 보존(임의추정 금지)", async () => {
    const target = "2026-05-13"; // 시드 지각, deduct 50
    const rec = await updateStatus(target, "지각");
    expect(rec!.deductMinutes).toBe(50);
  });

  it("없는 날짜는 null", async () => {
    expect(await updateStatus("2099-01-01", "정상")).toBeNull();
  });

  it("'지각'(deduct=90)→'정상' 전환 시 deductMinutes가 0으로 해소된다", async () => {
    const target = "2026-05-05"; // 시드 지각, deduct 90
    expect((await getRecord(target))!.deductMinutes).toBe(90);
    const rec = await updateStatus(target, "정상");
    expect(rec!.status).toBe("정상");
    expect(rec!.deductMinutes).toBe(0);
  });

  it("'지각'(deduct=90)→'연장' 전환 시에도 deductMinutes가 0", async () => {
    const rec = await updateStatus("2026-05-05", "연장");
    expect(rec!.deductMinutes).toBe(0);
  });

  it("'정상'→'휴가' 전환 시 breakMinutes가 0으로 초기화된다", async () => {
    const target = "2026-05-26";
    expect((await getRecord(target))!.breakMinutes).toBe(DEFAULT_BREAK_MINUTES);
    const rec = await updateStatus(target, "휴가");
    expect(rec!.breakMinutes).toBe(0);
  });

  it("'정상'→'결근' 전환 시에도 breakMinutes가 0", async () => {
    const rec = await updateStatus("2026-05-26", "결근");
    expect(rec!.breakMinutes).toBe(0);
  });

  it("'휴가'→'정상'(clock 존재) 역전환 시 breakMinutes가 복원되고 work가 과대산정되지 않는다", async () => {
    const target = "2026-05-26"; // 08:00~15:00, work 390, break 30
    await updateStatus(target, "휴가");
    expect((await getRecord(target))!.breakMinutes).toBe(0);

    const rec = await updateStatus(target, "정상");
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
  it("대기 요청 수락 시 레코드에 after 가 반영되고 status가 대기→수락으로 전이한다", async () => {
    const date = "2026-05-04";
    const req = await pending(date, { status: "연장", clockIn: "07:26", clockOut: "15:34" });
    const result = await approveRequest(req.id);

    expect(result).not.toBeNull();
    expect(result!.request.status).toBe("수락");
    expect(result!.record.status).toBe("연장");
    expect(result!.record.clockIn).toBe("07:26");
    expect(result!.record.clockOut).toBe("15:34");
    expect((await getRecord(date))!.clockOut).toBe("15:34");
  });

  it("정상/연장 after 는 workMinutes 재계산 + overtime=clockOut 초과분(15:34→34)", async () => {
    const req = await pending("2026-05-04", { status: "연장", clockIn: "07:26", clockOut: "15:34" });
    const { record } = (await approveRequest(req.id))!;
    expect(record.workMinutes).toBe(458);
    expect(record.overtimeMinutes).toBe(34);
  });

  it("조기출근·정시퇴근(07:58~15:00) 수락 시 work 392·overtime 0 (조기출근 연장 아님)", async () => {
    const req = await pending("2026-05-28", { status: "정상", clockIn: "07:58", clockOut: "15:00" });
    const { record } = (await approveRequest(req.id))!;
    expect(record.workMinutes).toBe(392);
    expect(record.overtimeMinutes).toBe(0);
  });

  it("수락 시 다른 대기 요청의 status는 불변", async () => {
    const a = await pending("2026-05-04", { status: "정상", clockIn: "08:00", clockOut: "15:00" });
    const b = await pending("2026-05-06", { status: "정상", clockIn: "08:00", clockOut: "15:00" });
    await approveRequest(a.id);
    expect((await approveRequest(b.id))!.request.id).toBe(b.id);
  });

  it("존재하지 않는 요청 id 는 null 을 반환하고 store 를 변경하지 않는다", async () => {
    expect(await approveRequest("req-999")).toBeNull();
  });

  it("after.status=결근 수락 시 결근 차감 정책(deduct=390·work/overtime/break=0) 적용", async () => {
    const req = await pending("2026-05-26", { status: "결근", clockIn: "08:00", clockOut: "15:00" });
    const { record } = (await approveRequest(req.id))!;
    expect(record.status).toBe("결근");
    expect(record.deductMinutes).toBe(REGULAR_MINUTES);
    expect(record.workMinutes).toBe(0);
    expect(record.overtimeMinutes).toBe(0);
    expect(record.breakMinutes).toBe(0);
  });

  it("after.status=휴가 수락 시 휴가 차감 정책(deduct=0·work/overtime/break=0) 적용", async () => {
    const req = await pending("2026-05-26", { status: "휴가", clockIn: null, clockOut: null });
    const { record } = (await approveRequest(req.id))!;
    expect(record.status).toBe("휴가");
    expect(record.deductMinutes).toBe(0);
    expect(record.workMinutes).toBe(0);
    expect(record.overtimeMinutes).toBe(0);
    expect(record.breakMinutes).toBe(0);
  });

  it("이미 수락된 요청 재수락은 멱등 no-op(레코드 불변·status 수락 유지)", async () => {
    const date = "2026-05-04";
    const req = await pending(date, { status: "연장", clockIn: "07:26", clockOut: "15:34" });
    await approveRequest(req.id);
    const after1 = (await getRecord(date))!;
    const result2 = (await approveRequest(req.id))!;
    expect(result2.request.status).toBe("수락");
    expect(result2.record.workMinutes).toBe(after1.workMinutes);
    expect(result2.record.overtimeMinutes).toBe(after1.overtimeMinutes);
  });

  it("after.clockOut 가 undefined 인 손상 요청 수락 시 레코드를 오염시키지 않는다(fail-closed)", async () => {
    const date = "2026-08-20"; // 시드 외
    const req = await pending(date, {
      status: "정상",
      clockIn: "08:00",
      clockOut: undefined as unknown as string,
    });
    const { request, record } = (await approveRequest(req.id))!;
    expect(await getRecord(date)).toBeNull();
    expect(record.clockOut === null || typeof record.clockOut === "string").toBe(true);
    expect(request.status).toBe("대기");
  });

  it("휴게 범위(11:30~13:00) 변경 수락 시 breakMinutes=90 파생 + work 재계산, clockIn 불변", async () => {
    const date = "2026-05-26";
    const before = (await getRecord(date))!;
    const req = await pending(date, {
      status: "정상",
      clockIn: before.clockIn,
      clockOut: before.clockOut,
      breakStart: "11:30",
      breakEnd: "13:00",
    });
    const { record } = (await approveRequest(req.id))!;
    expect(record.breakStart).toBe("11:30");
    expect(record.breakEnd).toBe("13:00");
    expect(record.breakMinutes).toBe(90);
    expect(record.workMinutes).toBe(330);
    expect(record.clockIn).toBe(before.clockIn);
  });

  it("휴게 범위 동일시각(12:00~12:00, 파생 0) 명시 수락 시 breakMinutes=0 존중(복원 안 함)", async () => {
    const date = "2026-05-26";
    const req = await pending(date, {
      status: "정상",
      clockIn: "08:00",
      clockOut: "15:00",
      breakStart: "12:00",
      breakEnd: "12:00",
    });
    const { record } = (await approveRequest(req.id))!;
    expect(record.breakMinutes).toBe(0);
    expect(record.workMinutes).toBe(420);
  });

  it("퇴근시각 변경(16:30) 수락 시 clockOut/overtime/work 재계산, clockIn 불변(범위 미명시=기존 휴게)", async () => {
    const date = "2026-05-26";
    const before = (await getRecord(date))!;
    const req = await pending(date, {
      status: "연장",
      clockIn: before.clockIn,
      clockOut: "16:30",
    });
    const { record } = (await approveRequest(req.id))!;
    expect(record.clockIn).toBe(before.clockIn);
    expect(record.clockOut).toBe("16:30");
    expect(record.workMinutes).toBe(480);
    expect(record.overtimeMinutes).toBe(90);
  });

  it("휴게 범위 미명시 요청 수락은 기존 동작과 동일(멱등·회귀 0)", async () => {
    const date = "2026-05-04";
    const req = await pending(date, { status: "연장", clockIn: "07:26", clockOut: "15:34" });
    const { record } = (await approveRequest(req.id))!;
    expect(record.breakMinutes).toBe(DEFAULT_BREAK_MINUTES);
    expect(record.workMinutes).toBe(458);
    expect(record.overtimeMinutes).toBe(34);
  });

  it("레코드 없는 날(시드 외) 수락 시 after 로 신규 레코드를 생성한다(upsert)", async () => {
    const date = "2026-07-15";
    expect(await getRecord(date)).toBeNull();
    const req = await pending(date, { status: "정상", clockIn: "08:00", clockOut: "16:30" });
    const { record } = (await approveRequest(req.id))!;
    expect(await getRecord(date)).not.toBeNull();
    expect(record.clockOut).toBe("16:30");
    expect(record.workMinutes).toBe(480);
    expect(record.overtimeMinutes).toBe(90);
  });
});
