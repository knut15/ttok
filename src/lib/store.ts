// 인메모리 store (모듈 싱글톤, server-only) — 미이관 도메인(스케줄/고정근무/알림/프로필/crews/invites) 유지.
// 출퇴근·수정요청·집계는 Prisma 단일 진실원(attendance-store)로 이관(P1). client 직접 import 금지.
// ※ P2/P3 에서 잔여 도메인도 Prisma 로 이관 예정.

import type {
  Crew,
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
  AttendanceRecord,
  EditRequest,
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
import {
  DEFAULT_CREW_ID,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  MASTER_ID,
} from "./constants";

// === 출퇴근·수정요청·집계: Prisma 단일 진실원(attendance-store)로 이관(P1) ===
export {
  getMonthRecords,
  getRecord,
  updateStatus,
  upsertTodayClock,
  listRequests,
  listRequestsForCrews,
  addRequest,
  approveRequest,
  getCrewAggregate,
} from "./attendance-store";
export type { NewEditRequest } from "./attendance-store";

// T8: 멀티멤버 내부 표현. (P2/P3 이관 전까지 스케줄/고정/알림/프로필/crews/invites 보유)
interface StoreShape {
  crews: Crew[];
  recordsByCrew: Map<string, Map<string, AttendanceRecord>>; // (미사용·가드용) P1 이후 Prisma
  requests: EditRequest[]; // (미사용) P1 이후 Prisma
  invites: Invite[];
  profilesByCrew: Map<string, UserProfile>;
  schedulesByDate: Map<string, ScheduleEntry[]>;
  fixedShifts: FixedShift[];
  notifications: Notification[];
  storeInfo: StoreInfo;
  seq: number;
}

declare global {
  var __crewmonStore: StoreShape | undefined;
}

function createStore(): StoreShape {
  const profilesByCrew = new Map<string, UserProfile>();
  profilesByCrew.set(DEFAULT_CREW_ID, buildSeedProfile());
  return {
    crews: buildSeedCrews(),
    recordsByCrew: buildSeedRecordsByCrew(),
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

function getStore(): StoreShape {
  const s = globalThis.__crewmonStore;
  if (
    !s ||
    !(s.recordsByCrew instanceof Map) ||
    !(s.profilesByCrew instanceof Map) ||
    !(s.schedulesByDate instanceof Map) ||
    !Array.isArray(s.fixedShifts) ||
    !Array.isArray(s.notifications) ||
    !Array.isArray(s.crews)
  ) {
    globalThis.__crewmonStore = createStore();
  }
  return globalThis.__crewmonStore as StoreShape;
}

/** 테스트 격리용(미이관 도메인): store 를 시드 상태로 재생성. */
export function __resetStore(): void {
  globalThis.__crewmonStore = createStore();
}

// === 마이페이지/프로필 접근자 ===

/** crewId 의 프로필 반환(없으면 해당 멤버 정보로 파생 + 등록). 내부 헬퍼. */
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

/** 프로필+매장 조회. O(1). crewId 생략 → 김민정(회귀). */
export function getProfile(crewId: string = DEFAULT_CREW_ID): ProfileResponse {
  const s = getStore();
  return { profile: crewProfile(s, crewId), store: s.storeInfo, isManager: isManagerCrew(crewId) };
}

/** 허용 필드(phone/email)만 머지. 읽기전용 필드는 화이트리스트로 무시. crewId 생략 → 김민정. */
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

// === 멤버 목록 / 초대(레거시 인메모리) / 역할 ===

/** mock 계정 목록(마스터 포함). */
export function listCrews(): Crew[] {
  return [...getStore().crews];
}

/** id 가 마스터 역할인가. */
export function isMaster(id: string): boolean {
  return getStore().crews.some((c) => c.id === id && c.role === "master");
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
  return `INV${Date.now().toString(36).toUpperCase()}`;
}

/** 마스터 초대 생성(레거시 인메모리, status="대기"). */
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

/** 코드 합류(레거시 인메모리). 없는 코드 → null, 이미 사용 → "used". */
export function joinByInvite(code: string, crewId: string): JoinResultOrError {
  const store = getStore();
  const invite = store.invites.find((i) => i.code === code);
  if (!invite) return null;
  if (invite.status !== "대기") return "used";

  invite.status = "사용";
  invite.targetCrewId = crewId;
  const crew = store.crews.find((c) => c.id === crewId);
  if (crew) crew.active = true;
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

// === 스케쥴표 store 함수 + 작성권한 ===

/** id 가 매니저 권한 crew 인가(role=crew + isManager). */
export function isManagerCrew(id: string): boolean {
  return getStore().crews.some((c) => c.id === id && c.role === "crew" && c.isManager === true);
}

/**
 * 스케쥴 작성권한 판정. master 면 무조건 true.
 * crew 는 세션 isManager(Prisma Membership 진실원) 우선, 없으면 인메모리 isManagerCrew(데모/레거시).
 */
export function canWriteSchedule(scope: {
  crewId: string;
  role: Role;
  isManager?: boolean;
}): boolean {
  if (scope.role === "master") return true;
  return scope.isManager === true || isManagerCrew(scope.crewId);
}

/** 매니저 지정/해제(레거시 인메모리). crew 역할만 토글. 없으면 null. */
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
  autoApprove?: boolean;
}

/** 해당 날짜·멤버가 대타(고정 요일 아닌 근무) 인지. off 면 false. */
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

/** 스케쥴 upsert — (date, crewId) 당 최대 1건. 대타면 approval 부여. */
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

/** 마스터 대타 승인. id 의 대타 entry approval → "수락" + 알림. 없으면 null. */
export function approveSubstitute(id: string): ScheduleEntry | null {
  const store = getStore();
  for (const list of store.schedulesByDate.values()) {
    const e = list.find((x) => x.id === id);
    if (e) {
      if (e.approval !== "수락") {
        e.approval = "수락";
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

export function listNotifications(crewId: string): Notification[] {
  return getStore()
    .notifications.filter((n) => n.crewId === crewId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadNotificationCount(crewId: string): number {
  return getStore().notifications.filter((n) => n.crewId === crewId && !n.read).length;
}

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

/** 스케쥴 삭제(id 기준 전 날짜 탐색). */
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

export function listFixedShifts(): FixedShift[] {
  return [...getStore().fixedShifts].sort(
    (a, b) => a.crewId.localeCompare(b.crewId) || (a.weekdays[0] ?? 0) - (b.weekdays[0] ?? 0),
  );
}

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

export function updateFixedShift(id: string, patch: FixedShiftPatch): FixedShift | null {
  const block = getStore().fixedShifts.find((f) => f.id === id);
  if (!block) return null;
  block.weekdays = [...new Set(patch.weekdays)].sort((a, b) => a - b);
  block.startTime = patch.startTime;
  block.endTime = patch.endTime;
  return block;
}

/** 월간 스케쥴 병합 뷰: 명시 배정(manual) 우선 + 고정근무 자동적용(fixed). */
export function getMonthScheduleView(month: string): ScheduleEntry[] {
  const fixed = getStore().fixedShifts;
  const hasFixedOn = (crewId: string, date: string) => {
    const w = getWeekdayIndex(date);
    return fixed.some((f) => f.crewId === crewId && f.weekdays.includes(w));
  };

  const explicit: ScheduleEntry[] = getMonthSchedules(month).map((e) => ({
    ...e,
    source: "manual",
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
