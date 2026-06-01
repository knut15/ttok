// 인메모리 store (모듈 싱글톤, server-only). architect §2.1.
// client 직접 import 금지 — 반드시 Route Handler 경유.
// 휘발성: 서버 재시작 시 seed 로 초기화(엣지#7, 명세 동작). globalThis 가드로 dev HMR 보존.

import type {
  ApproveResult,
  AttendanceRecord,
  Crew,
  CrewSummary,
  EditRequest,
  FixedShift,
  Invite,
  JoinResult,
  Notification,
  ProfilePatch,
  ProfileResponse,
  Role,
  ScheduleEntry,
  StoreInfo,
  UserProfile,
  WorkStatus,
} from "@/types";
import {
  buildSeedRecordsByCrew,
  buildSeedCrews,
  buildSeedFixedShifts,
  buildSeedInvites,
  buildSeedProfile,
  buildSeedSchedules,
  SEED_STORE_INFO,
} from "./seed";
import { buildMonthGrid } from "./date";
import { getWeekdayIndex } from "./schedule";
import { calcWorkMinutes, calcOvertimeByClock, calcBreakMinutes } from "./time";
import {
  DEFAULT_BREAK_MINUTES,
  DEFAULT_CREW_ID,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  MASTER_ID,
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

// T8: 멀티크루 내부 표현(architect §2.2). 계약은 trailing crewId fallback 으로 단일사용자 흐름 보존.
interface StoreShape {
  crews: Crew[]; // 마스터1 + 크루3
  recordsByCrew: Map<string, Map<string, AttendanceRecord>>; // crewId → date → rec
  requests: EditRequest[]; // crewId 태그(append)
  invites: Invite[];
  profilesByCrew: Map<string, UserProfile>; // crewId → profile
  schedulesByDate: Map<string, ScheduleEntry[]>; // T16: date → 배정 목록
  fixedShifts: FixedShift[]; // 크루별 고정근무 블록(여러 개 가능)
  notifications: Notification[]; // 크루 알림(대타 승인 등)
  storeInfo: StoreInfo; // 단일 매장 유지
  seq: number;
}

declare global {
  var __crewmonStore: StoreShape | undefined;
}

function createStore(): StoreShape {
  // 김민정(DEFAULT_CREW_ID) Map 은 buildSeedRecords() 로 채운다(바이트 동일, 회귀 0).
  const recordsByCrew = buildSeedRecordsByCrew();
  const profilesByCrew = new Map<string, UserProfile>();
  profilesByCrew.set(DEFAULT_CREW_ID, buildSeedProfile());
  return {
    crews: buildSeedCrews(),
    recordsByCrew,
    requests: [],
    invites: buildSeedInvites(),
    profilesByCrew,
    schedulesByDate: buildSeedSchedules(),
    fixedShifts: buildSeedFixedShifts(),
    notifications: [],
    storeInfo: SEED_STORE_INFO,
    seq: 1,
  };
}

/** joinByInvite 반환형: 성공 JoinResult / 없는코드 null / 사용됨 "used"(409 의미). */
export type JoinResultOrError = JoinResult | null | "used";

/** crewId 의 records Map 을 반환(없으면 빈 Map 생성·등록). 내부 헬퍼. */
function crewRecords(store: StoreShape, crewId: string): Map<string, AttendanceRecord> {
  let m = store.recordsByCrew.get(crewId);
  if (!m) {
    m = new Map<string, AttendanceRecord>();
    store.recordsByCrew.set(crewId, m);
  }
  return m;
}

function getStore(): StoreShape {
  const s = globalThis.__crewmonStore;
  // 형태 가드: 부재이거나, dev HMR 로 살아남은 옛 store 형태(T8 이전: recordsByCrew 부재)면 재생성.
  // 이 가드가 없으면 store 스키마 변경 후 dev 서버 재시작 전까지 store.recordsByCrew 가 undefined → 전 API 500.
  if (
    !s ||
    !(s.recordsByCrew instanceof Map) ||
    !(s.profilesByCrew instanceof Map) ||
    !(s.schedulesByDate instanceof Map) || // T16: 스키마 변경 가드(HMR 잔존 옛 store 재생성)
    !Array.isArray(s.fixedShifts) || // 고정근무 스키마 가드
    !Array.isArray(s.notifications) || // 알림 스키마 가드
    !Array.isArray(s.crews)
  ) {
    globalThis.__crewmonStore = createStore();
  }
  return globalThis.__crewmonStore as StoreShape;
}

/** 테스트 격리용: store 를 시드 상태로 재생성. */
export function __resetStore(): void {
  globalThis.__crewmonStore = createStore();
}

/** 해당 월("YYYY-MM") 레코드 배열. 날짜 오름차순. 빈 달/없는 크루 → []. crewId 생략 → 김민정(회귀). */
export function getMonthRecords(
  month: string,
  crewId: string = DEFAULT_CREW_ID,
): AttendanceRecord[] {
  const store = getStore();
  const map = store.recordsByCrew.get(crewId);
  if (!map) return [];
  return [...map.values()]
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getRecord(
  date: string,
  crewId: string = DEFAULT_CREW_ID,
): AttendanceRecord | null {
  return getStore().recordsByCrew.get(crewId)?.get(date) ?? null;
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
  crewId: string = DEFAULT_CREW_ID,
): AttendanceRecord | null {
  const store = getStore();
  const records = crewRecords(store, crewId);
  const rec = records.get(date);
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

  records.set(date, updated);
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
  crewId: string = DEFAULT_CREW_ID,
): AttendanceRecord {
  const store = getStore();
  const records = crewRecords(store, crewId);
  const prev =
    records.get(date) ??
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
  records.set(date, next);
  return next;
}

/** 수정요청 목록(최신순). crewId 지정 → 해당 크루 태그만, 생략 → 전체(마스터/기존 테스트). */
export function listRequests(crewId?: string): EditRequest[] {
  const all = getStore().requests;
  const scoped =
    crewId === undefined
      ? all
      : all.filter((r) => (r.crewId ?? DEFAULT_CREW_ID) === crewId);
  return [...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface NewEditRequest {
  date: string;
  reason: string;
  after: EditRequest["after"];
  crewId?: string; // T8: 미지정 → DEFAULT_CREW_ID 태그(회귀).
}

/** 수정요청 생성(AC-9). 생성 시 status "대기". crewId 미지정 → 김민정 태그. */
export function addRequest(req: NewEditRequest): EditRequest {
  const store = getStore();
  const crewId = req.crewId ?? DEFAULT_CREW_ID;
  const existing = crewRecords(store, crewId).get(req.date);
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
    crewId,
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

  // T8: 요청에 태그된 크루의 records Map 에 반영(미지정 → 김민정, 회귀). 게이트는 route 책임.
  const records = crewRecords(store, req.crewId ?? DEFAULT_CREW_ID);

  // Q2 멱등 no-op: 이미 수락이면 레코드 재반영 없이 현재 상태 반환.
  if (req.status === "수락") {
    const existing = records.get(req.date);
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
    const existing = records.get(req.date);
    return {
      request: req,
      record: existing ?? emptyRecord(req.date),
    };
  }
  // Q1 upsert: 레코드 없으면 after status/clock 을 입힐 기준 레코드를 신규 생성.
  const base = records.get(req.date) ?? newRecordFrom(req.date, after);
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

  records.set(req.date, record);
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

/** crewId 의 프로필 반환(없으면 해당 크루 정보로 파생 + 등록). 내부 헬퍼. */
function crewProfile(store: StoreShape, crewId: string): UserProfile {
  let p = store.profilesByCrew.get(crewId);
  if (!p) {
    const crew = store.crews.find((c) => c.id === crewId);
    p = {
      name: crew?.name ?? crewId,
      birthDate: "",
      phone: "",
      email: "",
      avatarInitial: crew?.avatarInitial ?? "?",
    };
    store.profilesByCrew.set(crewId, p);
  }
  return p;
}

/** 프로필+매장 조회. O(1). crewId 생략 → 김민정(회귀, AC-1/AC-4/AC-R2). */
export function getProfile(crewId: string = DEFAULT_CREW_ID): ProfileResponse {
  const s = getStore();
  return { profile: crewProfile(s, crewId), store: s.storeInfo };
}

/**
 * 허용 필드(phone/email)만 머지. 읽기전용 필드(name/birthDate)는 화이트리스트로 무시. O(1).
 * 형식 검증은 호출자(Route Handler) 책임. crewId 생략 → 김민정(회귀). (AC-2/AC-3)
 */
export function updateProfile(
  patch: ProfilePatch,
  crewId: string = DEFAULT_CREW_ID,
): UserProfile {
  const s = getStore();
  const current = crewProfile(s, crewId);
  const next: UserProfile = {
    ...current,
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
  };
  s.profilesByCrew.set(crewId, next);
  return next;
}

// === T8 신규 store 함수: 크루 목록 / 집계 / 초대 / 역할 (architect §2.3, §3) ===

/** mock 계정 목록(마스터 포함). 역할전환 UI용. (AC-1) */
export function listCrews(): Crew[] {
  return [...getStore().crews];
}

/** id 가 마스터 역할인가. (권한 게이트 보조) */
export function isMaster(id: string): boolean {
  return getStore().crews.some((c) => c.id === id && c.role === "master");
}

/**
 * 마스터 집계: 크루(role=crew)별 month 근무/연장/휴가 요약. 마스터 제외.
 * 빈 크루/없는 월 → 0(NaN 방어, E-5/E-6). O(C·d). (AC-10/AC-11)
 */
export function getCrewSummaries(month: string): CrewSummary[] {
  const store = getStore();
  return store.crews
    .filter((c) => c.role === "crew")
    .map((c) => {
      const map = store.recordsByCrew.get(c.id);
      const recs = map
        ? [...map.values()].filter((r) => r.date.startsWith(month))
        : [];
      const workMinutes = recs.reduce((s, r) => s + r.workMinutes, 0);
      const overtimeMinutes = recs.reduce((s, r) => s + r.overtimeMinutes, 0);
      const vacationDays = recs.filter((r) => r.status === "휴가").length;
      return {
        crewId: c.id,
        name: c.name,
        avatarInitial: c.avatarInitial,
        workMinutes,
        overtimeMinutes,
        vacationDays,
        isManager: c.isManager === true,
      };
    });
}

/** 고유 초대코드 생성(혼동문자 제외 알파벳). 충돌 시 최대 5회 재시도. */
function generateInviteCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      const idx = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
      code += INVITE_CODE_ALPHABET[idx];
    }
    if (!existing.has(code)) return code;
  }
  // 충돌 가드 소진 시 타임스탬프 suffix 로 보장.
  return `INV${Date.now().toString(36).toUpperCase()}`;
}

/** 마스터 초대 생성(status="대기"). 게이트(마스터만)는 route 책임. (AC-13) */
export function createInvite(masterId: string): Invite {
  const store = getStore();
  const existing = new Set(store.invites.map((i) => i.code));
  const invite: Invite = {
    code: generateInviteCode(existing),
    createdBy: masterId,
    status: "대기",
    createdAt: new Date().toISOString(),
  };
  store.invites.push(invite);
  return invite;
}

/**
 * 코드 합류(mock). 유효 미사용 코드 → 크루 active=true + 코드 사용됨, JoinResult 반환.
 * 없는 코드 → null(400 의미, E-2). 이미 사용된 코드 → "used"(409 의미, E-2b).
 * (AC-14)
 */
export function joinByInvite(
  code: string,
  crewId: string,
): JoinResultOrError {
  const store = getStore();
  const invite = store.invites.find((i) => i.code === code);
  if (!invite) return null; // E-2: 없는 코드
  if (invite.status !== "대기") return "used"; // E-2b: 이미 사용됨

  invite.status = "사용";
  invite.targetCrewId = crewId;
  const crew = store.crews.find((c) => c.id === crewId);
  if (crew) crew.active = true;
  // crew 가 없어도 합류 결과는 명시적으로 만들어 반환(mock 신뢰 모델).
  const resolved: Crew =
    crew ?? {
      id: crewId,
      name: crewId,
      role: "crew",
      avatarInitial: "?",
      joinDate: new Date().toISOString().slice(0, 10),
      active: true,
    };
  return { crew: resolved, ok: true };
}

// === T16 스케쥴표 store 함수 + 작성권한 (append-only, architect 미러: isMaster 패턴) ===

/** id 가 매니저 권한 crew 인가(role=crew + isManager). 마스터는 별도(isMaster). */
export function isManagerCrew(id: string): boolean {
  return getStore().crews.some((c) => c.id === id && c.role === "crew" && c.isManager === true);
}

/**
 * 스케쥴 작성권한 판정(서버 단일 진실원 — 헤더 신뢰 X).
 * master 면 무조건 true. crew 면 store 의 isManager 플래그로만 판정.
 */
export function canWriteSchedule(scope: { crewId: string; role: Role }): boolean {
  if (scope.role === "master") return true;
  return isManagerCrew(scope.crewId);
}

/**
 * 매니저 지정/해제(마스터 전용 — 게이트는 route 책임). crew 역할만 토글 가능.
 * 없는 id 또는 master 대상 → null(변경 안 함). 성공 시 갱신된 Crew 반환.
 */
export function setManager(crewId: string, on: boolean): Crew | null {
  const crew = getStore().crews.find((c) => c.id === crewId);
  if (!crew || crew.role !== "crew") return null;
  crew.isManager = on;
  return crew;
}

/** 해당 월("YYYY-MM") 스케쥴 배열. date 오름차순, 동일 날짜는 crewId 순. 빈 달 → []. */
export function getMonthSchedules(month: string): ScheduleEntry[] {
  const store = getStore();
  const out: ScheduleEntry[] = [];
  for (const [date, list] of store.schedulesByDate) {
    if (date.startsWith(month)) out.push(...list);
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.crewId.localeCompare(b.crewId),
  );
}

/** 해당 날짜("YYYY-MM-DD") 스케쥴 배열(crewId 순). 없으면 []. */
export function getDaySchedules(date: string): ScheduleEntry[] {
  const list = getStore().schedulesByDate.get(date);
  if (!list) return [];
  return [...list].sort((a, b) => a.crewId.localeCompare(b.crewId));
}

export interface NewSchedule {
  date: string;
  crewId: string;
  startTime: string;
  endTime: string;
  off?: boolean;
  createdBy: string;
  autoApprove?: boolean; // 마스터 작성 시 대타 자동 승인
}

/** 해당 날짜·크루가 대타(고정 요일 아닌 근무) 인지. off 면 false. */
function isSubstituteAssignment(
  store: StoreShape,
  date: string,
  crewId: string,
  off?: boolean,
): boolean {
  if (off) return false;
  const w = getWeekdayIndex(date);
  return !store.fixedShifts.some((f) => f.crewId === crewId && f.weekdays.includes(w));
}

/**
 * 스케쥴 upsert — "근무자별 시간" 모델상 (date, crewId) 당 최대 1건.
 * 동일 (date, crewId) 존재 → 시간/off/작성자 갱신(id 보존). 없으면 신규 생성(`sch-${seq}`).
 * 대타(고정 요일 아님)면 approval 부여: 신규 → autoApprove ? "수락" : "대기"(기존 승인상태 보존).
 */
export function upsertSchedule(input: NewSchedule): ScheduleEntry {
  const store = getStore();
  const list = store.schedulesByDate.get(input.date) ?? [];
  const existing = list.find((e) => e.crewId === input.crewId);
  const sub = isSubstituteAssignment(store, input.date, input.crewId, input.off);

  if (existing) {
    existing.startTime = input.startTime;
    existing.endTime = input.endTime;
    existing.createdBy = input.createdBy;
    if (input.off) existing.off = true;
    else delete existing.off;
    if (sub) {
      // 시간 변경엔 기존 승인상태 보존. 마스터 작성이면 즉시 수락.
      existing.approval = input.autoApprove ? "수락" : (existing.approval ?? "대기");
    } else {
      delete existing.approval;
    }
    return existing;
  }

  const created: ScheduleEntry = {
    id: `sch-${store.seq++}`,
    date: input.date,
    crewId: input.crewId,
    startTime: input.startTime,
    endTime: input.endTime,
    createdBy: input.createdBy,
    ...(input.off ? { off: true } : {}),
    ...(sub ? { approval: input.autoApprove ? "수락" : "대기" } : {}),
  };
  list.push(created);
  store.schedulesByDate.set(input.date, list);
  return created;
}

/** 마스터 대타 승인. id 의 대타 entry approval → "수락" + 해당 크루에게 알림. 없으면 null. */
export function approveSubstitute(id: string): ScheduleEntry | null {
  const store = getStore();
  for (const list of store.schedulesByDate.values()) {
    const e = list.find((x) => x.id === id);
    if (e) {
      if (e.approval !== "수락") {
        e.approval = "수락";
        // 대타 승인 시 해당 크루 + 마스터 양쪽에 알림.
        const crewName = store.crews.find((c) => c.id === e.crewId)?.name ?? e.crewId;
        pushNotification(e.crewId, `대타 근무(${e.date} ${e.startTime}~${e.endTime})가 승인되었습니다.`);
        pushNotification(
          MASTER_ID,
          `${crewName}님의 대타 근무(${e.date} ${e.startTime}~${e.endTime})를 승인했습니다.`,
        );
      }
      return e;
    }
  }
  return null;
}

// === 알림(Notification) ===

/** 크루에게 알림 추가(미읽음). */
export function pushNotification(crewId: string, message: string): Notification {
  const store = getStore();
  const n: Notification = {
    id: `noti-${store.seq++}`,
    crewId,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  };
  store.notifications.push(n);
  return n;
}

/** 크루 알림 목록(최신순). */
export function listNotifications(crewId: string): Notification[] {
  return getStore()
    .notifications.filter((n) => n.crewId === crewId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 크루 미읽음 알림 수. */
export function unreadNotificationCount(crewId: string): number {
  return getStore().notifications.filter((n) => n.crewId === crewId && !n.read).length;
}

/** 크루 알림 전부 읽음 처리. 처리 건수 반환. */
export function markNotificationsRead(crewId: string): number {
  let n = 0;
  for (const noti of getStore().notifications) {
    if (noti.crewId === crewId && !noti.read) {
      noti.read = true;
      n++;
    }
  }
  return n;
}

/** 승인 대기 대타 목록(approval==="대기"). 날짜순. */
export function listPendingSubstitutes(): ScheduleEntry[] {
  const out: ScheduleEntry[] = [];
  for (const list of getStore().schedulesByDate.values()) {
    for (const e of list) if (e.approval === "대기") out.push(e);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.crewId.localeCompare(b.crewId));
}

/** 스케쥴 삭제(id 기준 전 날짜 탐색). 제거 성공 → true, 없으면 false. */
export function removeSchedule(id: string): boolean {
  const store = getStore();
  for (const [date, list] of store.schedulesByDate) {
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) continue;
    list.splice(idx, 1);
    if (list.length === 0) store.schedulesByDate.delete(date);
    return true;
  }
  return false;
}

// === 고정 근무(FixedShift) + 병합 뷰 ===

/** 고정근무 블록 목록(crewId, 시작요일 순). 크루당 여러 블록 가능. */
export function listFixedShifts(): FixedShift[] {
  return [...getStore().fixedShifts].sort(
    (a, b) => a.crewId.localeCompare(b.crewId) || (a.weekdays[0] ?? 0) - (b.weekdays[0] ?? 0),
  );
}

/** 크루가 이미 사용 중인 요일 집합(블록 추가 시 중복 방지용). */
export function crewFixedWeekdays(crewId: string): Set<number> {
  const set = new Set<number>();
  for (const f of getStore().fixedShifts) {
    if (f.crewId === crewId) for (const w of f.weekdays) set.add(w);
  }
  return set;
}

export interface NewFixedShift {
  crewId: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
}

/** 고정근무 블록 추가. 요일 정규화(중복제거·정렬) 후 신규 id 부여. */
export function addFixedShift(input: NewFixedShift): FixedShift {
  const store = getStore();
  const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
  const created: FixedShift = {
    id: `fix-${store.seq++}`,
    crewId: input.crewId,
    weekdays,
    startTime: input.startTime,
    endTime: input.endTime,
  };
  store.fixedShifts.push(created);
  return created;
}

/** 고정근무 블록 삭제(id). 제거 성공 → true. */
export function removeFixedShift(id: string): boolean {
  const store = getStore();
  const idx = store.fixedShifts.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  store.fixedShifts.splice(idx, 1);
  return true;
}

export interface FixedShiftPatch {
  weekdays: number[];
  startTime: string;
  endTime: string;
}

/** 고정근무 블록 편집(id). 요일 정규화. 없으면 null. (겹침 검증은 route 책임) */
export function updateFixedShift(id: string, patch: FixedShiftPatch): FixedShift | null {
  const block = getStore().fixedShifts.find((f) => f.id === id);
  if (!block) return null;
  block.weekdays = [...new Set(patch.weekdays)].sort((a, b) => a - b);
  block.startTime = patch.startTime;
  block.endTime = patch.endTime;
  return block;
}

/**
 * 월간 스케쥴 병합 뷰: 명시 배정(manual) 우선 + 고정근무 자동적용(fixed).
 * 같은 (date, crewId) 에 명시 배정이 있으면 고정근무는 생략(명시가 변동/오버라이드).
 * 고정 파생 항목은 id=`fixed-…`, source="fixed" (미저장 가상).
 */
export function getMonthScheduleView(month: string): ScheduleEntry[] {
  const fixed = getStore().fixedShifts;
  // 해당 날짜 요일에 크루의 고정근무 블록이 하나라도 적용되는가(대타 판정용).
  const hasFixedOn = (crewId: string, date: string) => {
    const w = getWeekdayIndex(date);
    return fixed.some((f) => f.crewId === crewId && f.weekdays.includes(w));
  };

  const explicit: ScheduleEntry[] = getMonthSchedules(month).map((e) => ({
    ...e,
    source: "manual",
    // 대타: 근무(off 아님)인데 그날 요일의 고정근무가 없는 경우.
    substitute: e.off !== true && !hasFixedOn(e.crewId, e.date),
  }));
  const explicitKeys = new Set(explicit.map((e) => `${e.date}|${e.crewId}`));
  const derived: ScheduleEntry[] = [];
  if (fixed.length > 0) {
    for (const date of buildMonthGrid(month)) {
      if (!date) continue;
      const weekday = getWeekdayIndex(date);
      for (const fs of fixed) {
        if (!fs.weekdays.includes(weekday)) continue;
        if (explicitKeys.has(`${date}|${fs.crewId}`)) continue;
        derived.push({
          id: `fixed-${fs.crewId}-${date}`,
          date,
          crewId: fs.crewId,
          startTime: fs.startTime,
          endTime: fs.endTime,
          createdBy: "fixed",
          source: "fixed",
        });
      }
    }
  }
  return [...explicit, ...derived].sort(
    (a, b) => a.date.localeCompare(b.date) || a.crewId.localeCompare(b.crewId),
  );
}
