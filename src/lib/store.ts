// 인메모리 store (모듈 싱글톤, server-only). architect §2.1.
// client 직접 import 금지 — 반드시 Route Handler 경유.
// 휘발성: 서버 재시작 시 seed 로 초기화(엣지#7, 명세 동작). globalThis 가드로 dev HMR 보존.

import type {
  AttendanceRecord,
  EditRequest,
  ProfilePatch,
  ProfileResponse,
  StoreInfo,
  UserProfile,
  WorkStatus,
} from "@/types";
import { buildSeedRecords, buildSeedProfile, SEED_STORE_INFO } from "./seed";
import { calcWorkMinutes, calcOvertime } from "./time";
import { DEFAULT_BREAK_MINUTES } from "./constants";

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
 * - 휴가/결근 → 인정시간 0 (work/overtime/deduct=0), 휴게도 0 (clock 은 보존).
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
  if (status === "휴가" || status === "결근") {
    // 휴가=무급 / 결근=근무없음 → 인정시간 0 + 휴게 0 (clock 보존).
    updated = {
      ...rec,
      status,
      workMinutes: 0,
      overtimeMinutes: 0,
      deductMinutes: 0,
      breakMinutes: 0,
    };
  } else if (rec.clockIn && rec.clockOut) {
    // 휴가/결근에서 역전환 시 break=0 이면 기본값으로 복원 후 재계산.
    const breakMinutes =
      rec.breakMinutes === 0 ? DEFAULT_BREAK_MINUTES : rec.breakMinutes;
    const workMinutes = calcWorkMinutes({
      clockIn: rec.clockIn,
      clockOut: rec.clockOut,
      breakMinutes,
    });
    updated = {
      ...rec,
      status,
      breakMinutes,
      workMinutes,
      overtimeMinutes: calcOvertime(workMinutes),
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
    next.overtimeMinutes = calcOvertime(next.workMinutes);
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
