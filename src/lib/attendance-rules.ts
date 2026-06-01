// 출퇴근 상태/계산 순수 규칙(DB·store 비의존). store(인메모리/Prisma) 양쪽에서 재사용.
// 기존 store.ts 내부 로직(recalcClockFields/updateStatus/approveRequest)을 순수함수로 이식.
import type { AttendanceRecord, EditRequestChange, WorkStatus } from "@/types";
import { calcWorkMinutes, calcOvertimeByClock, calcBreakMinutes } from "./time";
import { DEFAULT_BREAK_MINUTES, REGULAR_MINUTES, WORK_STATUSES } from "./constants";

/**
 * clock 기반 정상/연장 재계산(휴게 복원 포함). 연장은 clockOut 의 정규 종료(15:00) 초과분(ADR 0001).
 * clock 한쪽이라도 null → work/overtime 0.
 */
export function recalcClockFields(rec: AttendanceRecord): AttendanceRecord {
  if (rec.clockIn && rec.clockOut) {
    const hasRange = Boolean(rec.breakStart && rec.breakEnd);
    const breakMinutes = hasRange
      ? calcBreakMinutes({ breakStart: rec.breakStart, breakEnd: rec.breakEnd, fallback: 0 })
      : rec.breakMinutes === 0
        ? DEFAULT_BREAK_MINUTES
        : rec.breakMinutes;
    return {
      ...rec,
      breakMinutes,
      workMinutes: calcWorkMinutes({ clockIn: rec.clockIn, clockOut: rec.clockOut, breakMinutes }),
      overtimeMinutes: calcOvertimeByClock({ clockOut: rec.clockOut }),
    };
  }
  return { ...rec, workMinutes: 0, overtimeMinutes: 0 };
}

/**
 * 출근상태 변경 정책(순수). rec 에 status 적용한 새 레코드 반환.
 * 결근=정규 전액차감, 휴가=무급(0), 정상/연장=재계산(휴게 복원), 지각=deduct 보존.
 */
export function applyStatusPolicy(rec: AttendanceRecord, status: WorkStatus): AttendanceRecord {
  if (status === "결근") {
    return { ...rec, status, workMinutes: 0, overtimeMinutes: 0, deductMinutes: REGULAR_MINUTES, breakMinutes: 0 };
  }
  if (status === "휴가") {
    return { ...rec, status, workMinutes: 0, overtimeMinutes: 0, deductMinutes: 0, breakMinutes: 0 };
  }
  if (rec.clockIn && rec.clockOut) {
    return {
      ...recalcClockFields({ ...rec, status }),
      deductMinutes: status === "지각" ? rec.deductMinutes : 0,
    };
  }
  return { ...rec, status, deductMinutes: status === "지각" ? rec.deductMinutes : 0 };
}

/** after 의 status/clock 을 입힌 신규 기준 레코드(upsert 기준값). 재계산은 호출부. */
export function newRecordFrom(date: string, after: EditRequestChange): AttendanceRecord {
  return {
    date,
    status: after.status,
    clockIn: after.clockIn,
    clockOut: after.clockOut,
    breakMinutes: DEFAULT_BREAK_MINUTES,
    workMinutes: 0,
    overtimeMinutes: 0,
    deductMinutes: 0,
  };
}

/** 손상 after 의 fail-closed 폴백용 안전 중립 레코드. */
export function emptyRecord(date: string): AttendanceRecord {
  return {
    date,
    status: "정상",
    clockIn: null,
    clockOut: null,
    breakMinutes: DEFAULT_BREAK_MINUTES,
    workMinutes: 0,
    overtimeMinutes: 0,
    deductMinutes: 0,
  };
}

/** after 가 store 반영 가능한 유효 형태인가(fail-closed 가드). */
export function isAfterValid(after: EditRequestChange): boolean {
  return (
    WORK_STATUSES.includes(after.status) &&
    (after.clockIn === null || typeof after.clockIn === "string") &&
    (after.clockOut === null || typeof after.clockOut === "string")
  );
}

/**
 * 수정요청 수락 시 after 를 base 에 반영한 레코드(순수). 재계산/정책 포함.
 * base 없으면 newRecordFrom 으로 신규 생성해 전달.
 */
export function applyAfter(base: AttendanceRecord, after: EditRequestChange): AttendanceRecord {
  const hasAfterRange = Boolean(after.breakStart && after.breakEnd);
  const merged: AttendanceRecord = {
    ...base,
    status: after.status,
    clockIn: after.clockIn,
    clockOut: after.clockOut,
    ...(hasAfterRange ? { breakStart: after.breakStart, breakEnd: after.breakEnd } : {}),
  };
  if (after.status === "결근") {
    return { ...merged, workMinutes: 0, overtimeMinutes: 0, deductMinutes: REGULAR_MINUTES, breakMinutes: 0 };
  }
  if (after.status === "휴가") {
    return { ...merged, workMinutes: 0, overtimeMinutes: 0, deductMinutes: 0, breakMinutes: 0 };
  }
  return {
    ...recalcClockFields(merged),
    deductMinutes: after.status === "지각" ? base.deductMinutes : 0,
  };
}
