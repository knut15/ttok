// 인메모리 store (모듈 싱글톤, server-only). architect §2.1.
// client 직접 import 금지 — 반드시 Route Handler 경유.
// 휘발성: 서버 재시작 시 seed 로 초기화(엣지#7, 명세 동작). globalThis 가드로 dev HMR 보존.

import type {
  ApproveResult,
  AttendanceRecord,
  EditRequest,
  ProfilePatch,
  ProfileResponse,
  StoreInfo,
  UserProfile,
  WorkStatus,
} from "@/types";
import { buildSeedRecords, buildSeedProfile, SEED_STORE_INFO } from "./seed";
import { calcWorkMinutes, calcOvertimeByClock, calcBreakMinutes } from "./time";
import {
  DEFAULT_BREAK_MINUTES,
  REGULAR_MINUTES,
  WORK_STATUSES,
} from "./constants";

/**
 * clock 기반 정상/연장 재계산(휴게 복원 포함) — 내부 private 헬퍼(architect §3.2, DRY).
 * 연장은 clockOut 의 정규 종료시각(15:00) 초과분(ADR 0001). deduct 는 호출부 정책.
 * clock 한쪽이라도 null 이면 work/overtime 0(E-4).
 */
function recalcClockFields(rec: AttendanceRecord): AttendanceRecord {
  if (rec.clockIn && rec.clockOut) {
    // R1 3-case 우선순위 (architect §2.6, T7):
    // ① 범위 둘 다 명시 → calcBreakMinutes 파생값 절대 존중(0이어도 복원 안 함).
    // ② 범위 없음 + breakMinutes>0 → 기존값.
    // ③ 범위 없음 + breakMinutes===0 → DEFAULT 복원(레거시·휴가역전환 호환).
    const hasRange = Boolean(rec.breakStart && rec.breakEnd);
    const breakMinutes = hasRange
      ? calcBreakMinutes({
          breakStart: rec.breakStart,
          breakEnd: rec.breakEnd,
          fallback: 0, // 범위 명시일 때 동일/역전은 0 으로 존중(복원 우회)
        })
      : rec.breakMinutes === 0
        ? DEFAULT_BREAK_MINUTES
        : rec.breakMinutes;
    const workMinutes = calcWorkMinutes({
      clockIn: rec.clockIn,
      clockOut: rec.clockOut,
      breakMinutes,
    });
    return {
      ...rec,
      breakMinutes,
      workMinutes,
      overtimeMinutes: calcOvertimeByClock({ clockOut: rec.clockOut }),
    };
  }
  return { ...rec, workMinutes: 0, overtimeMinutes: 0 };
}

interface StoreShape {
  records: Map<string, AttendanceRecord>; // key = "YYYY-MM-DD"
  requests: EditRequest[];
  seq: number;
  profile: UserProfile; // 신규 append — 마이페이지
  storeInfo: StoreInfo; // 신규 append — 소속 매장
}

declare global {
  var __crewmonStore: StoreShape | undefined;
}

function createStore(): StoreShape {
  const records = new Map<string, AttendanceRecord>();
  for (const r of buildSeedRecords()) records.set(r.date, r);
  return {
    records,
    requests: [],
    seq: 1,
    profile: buildSeedProfile(),
    storeInfo: SEED_STORE_INFO,
  };
}

function getStore(): StoreShape {
  if (!globalThis.__crewmonStore) {
    globalThis.__crewmonStore = createStore();
  }
  return globalThis.__crewmonStore;
}

/** 테스트 격리용: store 를 시드 상태로 재생성. */
export function __resetStore(): void {
  globalThis.__crewmonStore = createStore();
}

/** 해당 월("YYYY-MM") 레코드 배열. 날짜 오름차순. 빈 달 → []. */
export function getMonthRecords(month: string): AttendanceRecord[] {
  const store = getStore();
  return [...store.records.values()]
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getRecord(date: string): AttendanceRecord | null {
  return getStore().records.get(date) ?? null;
}

/**
 * 출근상태 변경(AC-8, 버그2). 없으면 null.
 * status 의존 연산 필드를 일관되게 재계산(CONTEXT.md 급여인정시간 정의):
 * - 결근 → 정규 전액 차감(deduct=REGULAR_MINUTES), work/overtime/break=0 (clock 은 보존).
 * - 휴가 → 무급(deduct=0), work/overtime/break=0 (clock 은 보존, 단순 0원).
 *   (역전환 시 break=0로 인한 근무시간 과대산정 방지 — 휴게는 아래 분기에서 복원)
 * - 정상/연장 → deduct=0 (지각 차감 해소). clock 존재 시 휴게 복원 후 work/overtime 재계산.
 * - 지각 → deduct 는 보존(지각 산식 본 범위 미정의 — 임의 추정 금지). clock 존재 시 재계산.
 */
export function updateStatus(
  date: string,
  status: WorkStatus,
): AttendanceRecord | null {
  const store = getStore();
  const rec = store.records.get(date);
  if (!rec) return null;

  let updated: AttendanceRecord;
  if (status === "결근") {
    // 결근 = 정규 전액 차감(급여 과다지급 방지). work/overtime/break=0, clock 보존.
    updated = {
      ...rec,
      status,
      workMinutes: 0,
      overtimeMinutes: 0,
      deductMinutes: REGULAR_MINUTES,
      breakMinutes: 0,
    };
  } else if (status === "휴가") {
    // 휴가 = 무급(차감 아님). 인정시간 0 + 휴게 0 (clock 보존).
    updated = {
      ...rec,
      status,
      workMinutes: 0,
      overtimeMinutes: 0,
      deductMinutes: 0,
      breakMinutes: 0,
    };
  } else if (rec.clockIn && rec.clockOut) {
    // 휴가/결근에서 역전환 시 break=0 이면 기본값으로 복원 후 재계산(공통 헬퍼, ADR 0001).
    updated = {
      ...recalcClockFields({ ...rec, status }),
      // 정상/연장 → 지각 차감 해소(deduct=0). 지각 → 기존 deduct 보존.
      deductMinutes: status === "지각" ? rec.deductMinutes : 0,
    };
  } else {
    updated = {
      ...rec,
      status,
      deductMinutes: status === "지각" ? rec.deductMinutes : 0,
    };
  }

  store.records.set(date, updated);
  return updated;
}

/**
 * 오늘 레코드의 출/퇴근 시각 기록(쟁점 C, 현재 시각).
 * 동일 time.ts 계산 함수를 통과시켜 시드 데이터와 계산 일관성 유지.
 */
export function upsertTodayClock(
  date: string,
  field: "clockIn" | "clockOut",
  time: string,
): AttendanceRecord {
  const store = getStore();
  const prev =
    store.records.get(date) ??
    ({
      date,
      status: "정상" as WorkStatus,
      clockIn: null,
      clockOut: null,
      breakMinutes: DEFAULT_BREAK_MINUTES,
      workMinutes: 0,
      overtimeMinutes: 0,
      deductMinutes: 0,
    } satisfies AttendanceRecord);

  const next: AttendanceRecord = { ...prev, [field]: time };
  // 버그1: 토글로 시각이 기록되면 그 날을 "근무한 날"로 만든다.
  // 휴가/결근(무근무·휴게0) 상태였다면 정상 근무일로 정상화한다.
  if (prev.status === "휴가" || prev.status === "결근") {
    next.status = "정상";
    next.breakMinutes = DEFAULT_BREAK_MINUTES;
    next.deductMinutes = 0;
  }
  if (next.clockIn && next.clockOut) {
    next.workMinutes = calcWorkMinutes({
      clockIn: next.clockIn,
      clockOut: next.clockOut,
      breakMinutes: next.breakMinutes,
    });
    next.overtimeMinutes = calcOvertimeByClock({ clockOut: next.clockOut });
  }
  store.records.set(date, next);
  return next;
}

export function listRequests(): EditRequest[] {
  return [...getStore().requests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export interface NewEditRequest {
  date: string;
  reason: string;
  after: EditRequest["after"];
}

/** 수정요청 생성(AC-9). 생성 시 status "대기". */
export function addRequest(req: NewEditRequest): EditRequest {
  const store = getStore();
  const existing = store.records.get(req.date);
  const before: EditRequest["before"] = existing
    ? {
        status: existing.status,
        clockIn: existing.clockIn,
        clockOut: existing.clockOut,
        // T7: before 스냅샷에 휴게 범위 포함(있으면). optional 이라 미부여 시 키 없음.
        ...(existing.breakStart && existing.breakEnd
          ? { breakStart: existing.breakStart, breakEnd: existing.breakEnd }
          : {}),
      }
    : { status: "정상", clockIn: null, clockOut: null };

  const created: EditRequest = {
    id: `req-${store.seq++}`,
    date: req.date,
    reason: req.reason,
    before,
    after: req.after,
    status: "대기",
    createdAt: new Date().toISOString(),
  };
  store.requests.push(created);
  return created;
}

/**
 * 수정요청 수락 반영(AC-1~4). 없으면 null(404).
 * - Q2 멱등: 이미 status="수락"이면 레코드 재반영 없이 현 {request,record} 반환.
 * - Q1 upsert: 대상 날짜 레코드가 없으면 after 로 신규 생성.
 * - after.status 별 정책은 updateStatus 와 동일(결근 전액차감 / 휴가 무급 / 정상·연장·지각 재계산).
 * - status 대기→수락 전이. 응답은 ApproveResult({request, record}).
 */
export function approveRequest(id: string): ApproveResult | null {
  const store = getStore();
  const req = store.requests.find((r) => r.id === id);
  if (!req) return null; // E-1 → 404

  // Q2 멱등 no-op: 이미 수락이면 레코드 재반영 없이 현재 상태 반환.
  if (req.status === "수락") {
    const existing = store.records.get(req.date);
    const record = existing ?? newRecordFrom(req.date, req.after);
    return { request: req, record };
  }

  const after = req.after;
  // 방어적 가드(이중 안전, P1-1/v3 P2): after 가 불완전하면 fail-closed — 레코드 미반영.
  // 정상 흐름은 생성 route 에서 이미 400 으로 차단되나, 손상 데이터 upsert 를 막는다.
  // status 무효 또는 clock 필드가 string|null 이 아니면(undefined 등) 반영하지 않는다.
  const afterIsValid =
    WORK_STATUSES.includes(after.status) &&
    (after.clockIn === null || typeof after.clockIn === "string") &&
    (after.clockOut === null || typeof after.clockOut === "string");
  if (!afterIsValid) {
    // 손상 after 는 절대 store 에 반영하지 않는다. 기존 레코드가 있으면 그대로,
    // 없으면 안전한 중립 레코드(빈 출퇴근)를 반환만 한다(persist 안 함).
    const existing = store.records.get(req.date);
    return {
      request: req,
      record: existing ?? emptyRecord(req.date),
    };
  }
  // Q1 upsert: 레코드 없으면 after status/clock 을 입힐 기준 레코드를 신규 생성.
  const base =
    store.records.get(req.date) ?? newRecordFrom(req.date, after);
  // after 에 휴게 범위가 명시되면 그것을 진실원으로 반영(없으면 base 의 기존 범위 유지).
  const hasAfterRange = Boolean(after.breakStart && after.breakEnd);
  const merged: AttendanceRecord = {
    ...base,
    status: after.status,
    clockIn: after.clockIn,
    clockOut: after.clockOut,
    ...(hasAfterRange
      ? { breakStart: after.breakStart, breakEnd: after.breakEnd }
      : {}),
  };

  let record: AttendanceRecord;
  if (after.status === "결근") {
    // 결근 = 정규 전액 차감(updateStatus 와 동일 정책, AC-4).
    record = {
      ...merged,
      workMinutes: 0,
      overtimeMinutes: 0,
      deductMinutes: REGULAR_MINUTES,
      breakMinutes: 0,
    };
  } else if (after.status === "휴가") {
    // 휴가 = 무급(차감 아님), work/overtime/break=0 (AC-4).
    record = {
      ...merged,
      workMinutes: 0,
      overtimeMinutes: 0,
      deductMinutes: 0,
      breakMinutes: 0,
    };
  } else {
    // 정상/연장/지각 → 휴게 복원 + work/overtime 재계산(공통 헬퍼).
    record = {
      ...recalcClockFields(merged),
      deductMinutes: after.status === "지각" ? base.deductMinutes : 0,
    };
  }

  store.records.set(req.date, record);
  req.status = "수락"; // 대기→수락 (AC-2)
  return { request: req, record };
}

/** 손상 after 의 fail-closed 폴백용 안전 중립 레코드(persist 안 함). */
function emptyRecord(date: string): AttendanceRecord {
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

/** after 의 status/clock 을 입힌 신규 레코드(upsert 기준값). 재계산은 호출부. */
function newRecordFrom(
  date: string,
  after: EditRequest["after"],
): AttendanceRecord {
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

// === 마이페이지/프로필 접근자 (append) ===

/** 프로필+매장 조회. O(1). (AC-1/AC-4) */
export function getProfile(): ProfileResponse {
  const s = getStore();
  return { profile: s.profile, store: s.storeInfo };
}

/**
 * 허용 필드(phone/email)만 머지. 읽기전용 필드(name/birthDate)는 화이트리스트로 무시. O(1).
 * 형식 검증은 호출자(Route Handler) 책임. (AC-2/AC-3)
 */
export function updateProfile(patch: ProfilePatch): UserProfile {
  const s = getStore();
  s.profile = {
    ...s.profile,
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
  };
  return s.profile;
}
