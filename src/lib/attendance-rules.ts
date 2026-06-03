// 출퇴근 상태/계산 순수 규칙(DB·store 비의존). store(인메모리/Prisma) 양쪽에서 재사용.
// 기존 store.ts 내부 로직(recalcClockFields/updateStatus/approveRequest)을 순수함수로 이식.
import type {
  AttendanceRecord,
  ClockInStatus,
  ClockOutStatus,
  EditRequestChange,
  WorkStatus,
} from "@/types";
import { calcWorkMinutes, calcOvertimeByClock, calcBreakMinutes } from "./time";
import { DEFAULT_BREAK_MINUTES, REGULAR_MINUTES, WORK_STATUSES } from "./constants";

// === 출근/퇴근 상태 분리(독립) ↔ 단일 status 파생 ===

/** 두 독립 상태 → 단일 status(달력/배지/급여 호환). 우선순위: 결근/휴가 > 연장 > 지각 > 정상. */
export function deriveStatus(ci: ClockInStatus, co: ClockOutStatus): WorkStatus {
  if (ci === "결근" || ci === "휴가") return ci;
  if (co === "연장") return "연장";
  if (ci === "지각") return "지각";
  return "정상";
}

/** 단일 status → 두 독립 상태(레거시·시드 마이그레이션). */
export function subStatusesFromStatus(status: WorkStatus): {
  clockInStatus: ClockInStatus;
  clockOutStatus: ClockOutStatus;
} {
  if (status === "결근") return { clockInStatus: "결근", clockOutStatus: "정상" };
  if (status === "휴가") return { clockInStatus: "휴가", clockOutStatus: "정상" };
  if (status === "연장") return { clockInStatus: "정상", clockOutStatus: "연장" };
  if (status === "지각") return { clockInStatus: "지각", clockOutStatus: "정상" };
  return { clockInStatus: "정상", clockOutStatus: "정상" };
}

/** 레코드의 두 상태 보강(미지정 시 status 에서 파생). */
function subOf(rec: AttendanceRecord): { ci: ClockInStatus; co: ClockOutStatus } {
  const d = subStatusesFromStatus(rec.status);
  return { ci: rec.clockInStatus ?? d.clockInStatus, co: rec.clockOutStatus ?? d.clockOutStatus };
}

/**
 * 출근 상태 변경(독립). 결근/휴가 → 무근무·퇴근상태 정상화. 지각/정상 → clock 재계산(휴게 복원).
 * 단일 status 는 두 상태 조합에서 파생.
 */
export function applyClockInStatus(rec: AttendanceRecord, ci: ClockInStatus): AttendanceRecord {
  const { co } = subOf(rec);
  if (ci === "결근") {
    return {
      ...rec, clockInStatus: ci, clockOutStatus: "정상", status: "결근",
      workMinutes: 0, overtimeMinutes: 0, deductMinutes: REGULAR_MINUTES, breakMinutes: 0,
    };
  }
  if (ci === "휴가") {
    return {
      ...rec, clockInStatus: ci, clockOutStatus: "정상", status: "휴가",
      workMinutes: 0, overtimeMinutes: 0, deductMinutes: 0, breakMinutes: 0,
    };
  }
  // 지각/정상: clock 있으면 재계산(휴게 복원), deduct 는 지각 보존/정상 해소.
  const base = rec.clockIn && rec.clockOut ? recalcClockFields(rec) : rec;
  const next: AttendanceRecord = {
    ...base,
    clockInStatus: ci,
    clockOutStatus: co,
    deductMinutes: ci === "지각" ? rec.deductMinutes : 0,
  };
  return { ...next, status: deriveStatus(ci, co) };
}

/** 퇴근 상태 변경(독립). 연장/정상 라벨. 연장 근무량은 clock(calcOvertimeByClock) 기준 유지. */
export function applyClockOutStatus(rec: AttendanceRecord, co: ClockOutStatus): AttendanceRecord {
  const { ci } = subOf(rec);
  // 무근무(결근/휴가)면 퇴근 상태는 의미 없음 — 정상 고정.
  if (ci === "결근" || ci === "휴가") {
    return { ...rec, clockOutStatus: "정상", status: ci };
  }
  return { ...rec, clockOutStatus: co, clockInStatus: ci, status: deriveStatus(ci, co) };
}

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
