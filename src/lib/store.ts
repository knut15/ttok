// 인메모리 store (모듈 싱글톤, server-only) — 잔여 미이관 도메인(프로필/crews/invites/manager).
// 출퇴근·수정요청·집계(P1) + 스케줄·고정근무·알림(P2)은 Prisma 단일 진실원으로 이관됨.
// ※ P3 에서 프로필/매장정보도 Prisma 로 이관 후 이 파일 제거 예정.

import type {
  Crew,
  Invite,
  JoinResult,
  ProfilePatch,
  ProfileResponse,
  Role,
  StoreInfo,
  UserProfile,
} from "@/types";
import { buildSeedCrews, buildSeedInvites, buildSeedProfile, SEED_STORE_INFO } from "./seed";
import { DEFAULT_CREW_ID, INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "./constants";

// === 출퇴근·수정요청·집계(P1): Prisma(attendance-store) ===
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

// === 스케줄·고정근무·알림(P2): Prisma(schedule-store) ===
export {
  getMonthSchedules,
  getDaySchedules,
  getMonthScheduleView,
  upsertSchedule,
  removeSchedule,
  listPendingSubstitutes,
  approveSubstitute,
  listFixedShifts,
  crewFixedWeekdays,
  addFixedShift,
  removeFixedShift,
  updateFixedShift,
  pushNotification,
  listNotifications,
  unreadNotificationCount,
  markNotificationsRead,
} from "./schedule-store";
export type { NewSchedule, NewFixedShift, FixedShiftPatch } from "./schedule-store";

// === 잔여 인메모리(프로필/crews/invites/manager) ===
interface StoreShape {
  crews: Crew[];
  invites: Invite[];
  profilesByCrew: Map<string, UserProfile>;
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
    invites: buildSeedInvites(),
    profilesByCrew,
    storeInfo: SEED_STORE_INFO,
    seq: 1,
  };
}

export type JoinResultOrError = JoinResult | null | "used";

function getStore(): StoreShape {
  const s = globalThis.__crewmonStore;
  if (!s || !(s.profilesByCrew instanceof Map) || !Array.isArray(s.crews) || !Array.isArray(s.invites)) {
    globalThis.__crewmonStore = createStore();
  }
  return globalThis.__crewmonStore as StoreShape;
}

/** 테스트 격리용(잔여 인메모리 도메인): store 를 시드 상태로 재생성. */
export function __resetStore(): void {
  globalThis.__crewmonStore = createStore();
}

// === 마이페이지/프로필 ===

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

export function getProfile(crewId: string = DEFAULT_CREW_ID): ProfileResponse {
  const s = getStore();
  return { profile: crewProfile(s, crewId), store: s.storeInfo, isManager: isManagerCrew(crewId) };
}

export function updateProfile(patch: ProfilePatch, crewId: string = DEFAULT_CREW_ID): UserProfile {
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

export function listCrews(): Crew[] {
  return [...getStore().crews];
}

export function isMaster(id: string): boolean {
  return getStore().crews.some((c) => c.id === id && c.role === "master");
}

function generateInviteCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  return `INV${Date.now().toString(36).toUpperCase()}`;
}

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

// === 매니저 권한(레거시 인메모리) ===

export function isManagerCrew(id: string): boolean {
  return getStore().crews.some((c) => c.id === id && c.role === "crew" && c.isManager === true);
}

/** master 면 true. crew 는 세션 isManager(Prisma 진실원) 우선, 없으면 인메모리(데모/레거시). */
export function canWriteSchedule(scope: { crewId: string; role: Role; isManager?: boolean }): boolean {
  if (scope.role === "master") return true;
  return scope.isManager === true || isManagerCrew(scope.crewId);
}

export function setManager(crewId: string, on: boolean): Crew | null {
  const crew = getStore().crews.find((c) => c.id === crewId);
  if (!crew || crew.role !== "crew") return null;
  crew.isManager = on;
  return crew;
}
