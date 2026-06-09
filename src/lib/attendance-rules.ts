// 출퇴근 상태/계산 순수 규칙(DB·store 비의존). store(인메모리/Prisma) 양쪽에서 재사용.
// 기존 store.ts 내부 로직(recalcClockFields/updateStatus/approveRequest)을 순수함수로 이식.
import type {
  AttendanceRecord,
  ClockInStatus,
  ClockOutStatus,
  EditRequestChange,
  WorkStatus,
} from "@/types";
import { calcWorkMinutes, calcOvertimeByClock, calcBreakMinutes, parseHHMM, legalBreakMinutes } from "./time";
import { DEFAULT_BREAK_MINUTES, REGULAR_MINUTES, WORK_STATUSES } from "./constants";

// === 출근/퇴근 상태 분리(독립) ↔ 단일 status 파생 ===

/** 두 독립 상태 → 단일 status(달력/배지/급여 호환). 우선순위: 결근/휴가 > 연장 > 조퇴 > 지각 > 정상. */
export function deriveStatus(ci: ClockInStatus, co: ClockOutStatus): WorkStatus {
  if (ci === "결근" || ci === "휴가") return ci;
  if (co === "연장") return "연장";
  if (co === "조퇴") return "조퇴";
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
  if (status === "조퇴") return { clockInStatus: "정상", clockOutStatus: "조퇴" };
  if (status === "대타") return { clockInStatus: "정상", clockOutStatus: "정상" };
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
  // co 반영 후 clock 재계산 — 조퇴→연장 0, 연장/정상→퇴근 15:00 초과분(라벨↔연장시간 정합).
  const next: AttendanceRecord = { ...rec, clockOutStatus: co, clockInStatus: ci };
  const recalced = next.clockIn && next.clockOut ? recalcClockFields(next) : next;
  return { ...recalced, status: deriveStatus(ci, co) };
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
    // 조퇴는 일찍 퇴근 — 연장(15:00 초과)을 인정하지 않음(라벨↔연장시간 정합).
    const isEarlyLeave = rec.status === "조퇴" || rec.clockOutStatus === "조퇴";
    return {
      ...rec,
      breakMinutes,
      workMinutes: calcWorkMinutes({ clockIn: rec.clockIn, clockOut: rec.clockOut, breakMinutes }),
      overtimeMinutes: isEarlyLeave ? 0 : calcOvertimeByClock({ clockOut: rec.clockOut }),
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
  // 통합 status 에서 출퇴근 독립상태 파생(조퇴=퇴근측 → 상세화면 퇴근 배지 일관). base 없는 추가요청 경로 단일 진입점.
  const { clockInStatus, clockOutStatus } = subStatusesFromStatus(after.status);
  return {
    date,
    status: after.status,
    clockIn: after.clockIn,
    clockOut: after.clockOut,
    clockInStatus,
    clockOutStatus,
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

// === 예정 근무시간(FixedShift) 기준 자동 판정 — 멤버별 근무시간 반영 ===

/** 멤버의 그날 예정 근무시간(분). FixedShift(요일 매칭) → 시작/종료 분. */
export interface ScheduledShift {
  startMin: number;
  endMin: number;
}

/**
 * 예정 근무시간 기준 출퇴근 자동 판정. 실제 출퇴근 시각 + 예정(sched) → 지각/조퇴/연장 + work/overtime.
 *  - 지각: 실제출근 > 예정출근(startMin)
 *  - 조퇴: 실제퇴근 < 예정퇴근(endMin)
 *  - 연장: 실제퇴근 > 예정퇴근 → 초과분(overtimeMinutes)
 *  - 예정 없음(비번, sched=null): 라벨 정상·연장 0 (대타 분류는 별도 단계).
 */
export function deriveScheduledClock(i: {
  clockIn: string | null;
  clockOut: string | null;
  sched: ScheduledShift | null;
  /** 예정이 등록된 멤버인데 그날이 근무 요일이 아님(비번). 예정 미설정 멤버는 false. */
  offDay: boolean;
}): {
  clockInStatus: ClockInStatus;
  clockOutStatus: ClockOutStatus;
  status: WorkStatus;
  workMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
} {
  const { clockIn, clockOut, sched } = i;
  const inM = clockIn ? parseHHMM(clockIn) : NaN;
  const outM = clockOut ? parseHHMM(clockOut) : NaN;

  const clockInStatus: ClockInStatus =
    sched && !Number.isNaN(inM) && inM > sched.startMin ? "지각" : "정상";

  let clockOutStatus: ClockOutStatus = "정상";
  let overtimeMinutes = 0;
  if (sched && !Number.isNaN(outM)) {
    if (outM > sched.endMin) {
      clockOutStatus = "연장";
      overtimeMinutes = outM - sched.endMin;
    } else if (outM < sched.endMin) {
      clockOutStatus = "조퇴";
    }
  }

  // 휴게: 재실시간(gross=퇴근−출근) 기준 법정 자동(4h 미만 0, 8h 미만 30, 이상 60). work = gross − 휴게.
  const gross =
    clockIn && clockOut && !Number.isNaN(inM) && !Number.isNaN(outM)
      ? Math.max(0, outM - inM)
      : 0;
  const breakMinutes = legalBreakMinutes(gross);
  const workMinutes = Math.max(0, gross - breakMinutes);

  // 비번(예정 있는 멤버의 근무 요일 아님)에 출근 = 대타. 예정 미설정(offDay=false)은 정상.
  const status: WorkStatus =
    i.offDay && Boolean(clockIn) ? "대타" : deriveStatus(clockInStatus, clockOutStatus);

  return { clockInStatus, clockOutStatus, status, workMinutes, overtimeMinutes, breakMinutes };
}
