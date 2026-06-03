import { describe, it, expect, beforeEach } from "vitest";
import { getRecord, setClockInStatus, setClockOutStatus } from "./store";
import { resetDb } from "./db-seed";
import { deriveStatus } from "./attendance-rules";

const D = "2026-05-26"; // 시드 정상 08:00~15:00

beforeEach(async () => {
  await resetDb();
});

describe("출근/퇴근 상태 독립 변경", () => {
  it("출근을 지각으로 변경하면 clockInStatus=지각 (퇴근 영향 없음)", async () => {
    const r = await setClockInStatus(D, "지각");
    expect(r!.clockInStatus).toBe("지각");
    expect(r!.clockOutStatus).toBe("정상");
    expect((await getRecord(D))!.clockInStatus).toBe("지각");
  });

  it("퇴근을 연장으로 변경하면 clockOutStatus=연장 (출근 영향 없음)", async () => {
    const r = await setClockOutStatus(D, "연장");
    expect(r!.clockOutStatus).toBe("연장");
    expect(r!.clockInStatus).toBe("정상");
  });

  it("출근=지각 + 퇴근=연장 을 동시에 보유한다", async () => {
    await setClockInStatus(D, "지각");
    const r = await setClockOutStatus(D, "연장");
    expect(r!.clockInStatus).toBe("지각");
    expect(r!.clockOutStatus).toBe("연장");
    // 단일 status 는 파생(연장 우선) — 달력/배지 호환.
    expect(r!.status).toBe(deriveStatus("지각", "연장"));
    const stored = (await getRecord(D))!;
    expect(stored.clockInStatus).toBe("지각");
    expect(stored.clockOutStatus).toBe("연장");
  });

  it("출근=결근 으로 바꾸면 퇴근상태는 정상으로 정상화되고 전액 차감", async () => {
    await setClockOutStatus(D, "연장");
    const r = await setClockInStatus(D, "결근");
    expect(r!.clockInStatus).toBe("결근");
    expect(r!.clockOutStatus).toBe("정상");
    expect(r!.workMinutes).toBe(0);
    expect(r!.deductMinutes).toBeGreaterThan(0);
  });

  it("없는 날짜는 null", async () => {
    expect(await setClockInStatus("2099-01-01", "지각")).toBeNull();
    expect(await setClockOutStatus("2099-01-01", "연장")).toBeNull();
  });
});
