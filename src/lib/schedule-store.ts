// 스케줄·고정근무·알림 데이터 계층(Prisma 단일 진실원). 순수 병합 규칙(schedule-view) 재사용.
// 운영행은 storeId + crewId. per-crew 변이는 storeIdForCrew 로 storeId 해석.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { storeIdForCrew } from "./identity-repo";
import { mergeScheduleView, isSubstitute } from "./schedule-view";
import type { FixedShift, Notification, ScheduleEntry } from "@/types";

type SchedRow = Prisma.ScheduleEntryGetPayload<object>;
type FixedRow = Prisma.FixedShiftGetPayload<object>;
type NotiRow = Prisma.NotificationGetPayload<object>;

/** Prisma 스케줄행 → 도메인(merge 가 substitute/source 보강하므로 raw 필드만). */
function toEntry(row: SchedRow): ScheduleEntry {
  return {
    id: row.id,
    date: row.date,
    crewId: row.crewId,
    startTime: row.startTime,
    endTime: row.endTime,
    createdBy: row.createdBy,
    ...(row.off ? { off: true } : {}),
    ...(row.substitute ? { substitute: true } : {}),
    ...(row.approval ? { approval: row.approval as "대기" | "수락" } : {}),
  };
}

function toFixed(row: FixedRow): FixedShift {
  return {
    id: row.id,
    crewId: row.crewId,
    weekdays: row.weekdays,
    startTime: row.startTime,
    endTime: row.endTime,
  };
}

async function requireStoreId(crewId: string): Promise<string> {
  const storeId = await storeIdForCrew(crewId);
  if (!storeId) throw new Error(`storeId not found for crewId=${crewId}`);
  return storeId;
}

// === 스케줄 ===

/** 매장 월간 명시 배정(manual) — date/crewId 순. */
export async function getMonthSchedules(storeId: string, month: string): Promise<ScheduleEntry[]> {
  const rows = await prisma.scheduleEntry.findMany({
    where: { storeId, date: { startsWith: month } },
    orderBy: [{ date: "asc" }, { crewId: "asc" }],
  });
  return rows.map(toEntry);
}

/** 매장 특정일 명시 배정(crewId 순). */
export async function getDaySchedules(storeId: string, date: string): Promise<ScheduleEntry[]> {
  const rows = await prisma.scheduleEntry.findMany({
    where: { storeId, date },
    orderBy: { crewId: "asc" },
  });
  return rows.map(toEntry);
}

/** 매장 고정근무 목록(crewId, 시작요일 순). */
export async function listFixedShifts(storeId: string): Promise<FixedShift[]> {
  const rows = await prisma.fixedShift.findMany({ where: { storeId } });
  return rows
    .map(toFixed)
    .sort((a, b) => a.crewId.localeCompare(b.crewId) || (a.weekdays[0] ?? 0) - (b.weekdays[0] ?? 0));
}

/** 매장 월간 병합 뷰(명시 + 고정 파생). 순수 mergeScheduleView 재사용. */
export async function getMonthScheduleView(storeId: string, month: string): Promise<ScheduleEntry[]> {
  const [explicit, fixed] = await Promise.all([
    getMonthSchedules(storeId, month),
    listFixedShifts(storeId),
  ]);
  return mergeScheduleView(month, explicit, fixed);
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

/** 스케줄 upsert — (crewId,date) 1건. 대타(고정 요일 아님)면 approval 부여. */
export async function upsertSchedule(input: NewSchedule): Promise<ScheduleEntry> {
  const storeId = await requireStoreId(input.crewId);
  const crewFixed = (await prisma.fixedShift.findMany({ where: { crewId: input.crewId } })).map(toFixed);
  const sub = isSubstitute(input.date, input.crewId, crewFixed, input.off);
  const existing = await prisma.scheduleEntry.findUnique({
    where: { crewId_date: { crewId: input.crewId, date: input.date } },
  });

  const off = input.off === true;
  const approval = sub
    ? input.autoApprove
      ? "수락"
      : (existing?.approval ?? "대기")
    : null;

  const row = await prisma.scheduleEntry.upsert({
    where: { crewId_date: { crewId: input.crewId, date: input.date } },
    create: {
      storeId,
      crewId: input.crewId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      off,
      createdBy: input.createdBy,
      substitute: sub,
      approval,
    },
    update: {
      startTime: input.startTime,
      endTime: input.endTime,
      off,
      createdBy: input.createdBy,
      substitute: sub,
      approval,
    },
  });
  return toEntry(row);
}

/** 스케줄 삭제(id). 성공 → true. */
export async function removeSchedule(id: string): Promise<boolean> {
  const res = await prisma.scheduleEntry.deleteMany({ where: { id } });
  return res.count > 0;
}

/** 매장 승인 대기 대타 목록(approval="대기"). 날짜순. */
export async function listPendingSubstitutes(storeId: string): Promise<ScheduleEntry[]> {
  const rows = await prisma.scheduleEntry.findMany({
    where: { storeId, approval: "대기" },
    orderBy: [{ date: "asc" }, { crewId: "asc" }],
  });
  return rows.map(toEntry);
}

/** 마스터 대타 승인. approval→"수락" + 멤버·마스터 알림. 없으면 null. */
export async function approveSubstitute(id: string): Promise<ScheduleEntry | null> {
  const row = await prisma.scheduleEntry.findUnique({ where: { id } });
  if (!row) return null;
  if (row.approval !== "수락") {
    await prisma.scheduleEntry.update({ where: { id }, data: { approval: "수락" } });
    const crewName = await crewNameFor(row.storeId, row.crewId);
    await pushNotification(row.crewId, `대타 근무(${row.date} ${row.startTime}~${row.endTime})가 승인되었습니다.`);
    const masterCrewId = await masterCrewIdFor(row.storeId);
    if (masterCrewId) {
      await pushNotification(
        masterCrewId,
        `${crewName}님의 대타 근무(${row.date} ${row.startTime}~${row.endTime})를 승인했습니다.`,
      );
    }
  }
  return toEntry({ ...row, approval: "수락" });
}

/** 매장 멤버 crewId → 이름(User). 없으면 crewId. */
async function crewNameFor(storeId: string, crewId: string): Promise<string> {
  const m = await prisma.membership.findFirst({
    where: { storeId, OR: [{ operationalId: crewId }, { id: crewId }] },
    include: { user: true },
  });
  return m?.user?.name ?? crewId;
}

/** 매장의 master crewId(operationalId ?? membershipId). */
async function masterCrewIdFor(storeId: string): Promise<string | null> {
  const m = await prisma.membership.findFirst({ where: { storeId, role: "master" } });
  return m ? (m.operationalId ?? m.id) : null;
}

// === 고정근무 ===

/** 멤버가 사용 중인 요일 집합(블록 추가 시 중복 방지). */
export async function crewFixedWeekdays(crewId: string): Promise<Set<number>> {
  const rows = await prisma.fixedShift.findMany({ where: { crewId }, select: { weekdays: true } });
  const set = new Set<number>();
  for (const r of rows) for (const w of r.weekdays) set.add(w);
  return set;
}

export interface NewFixedShift {
  crewId: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export async function addFixedShift(input: NewFixedShift): Promise<FixedShift> {
  const storeId = await requireStoreId(input.crewId);
  const weekdays = [...new Set(input.weekdays)].sort((a, b) => a - b);
  const row = await prisma.fixedShift.create({
    data: { storeId, crewId: input.crewId, weekdays, startTime: input.startTime, endTime: input.endTime },
  });
  return toFixed(row);
}

export async function removeFixedShift(id: string): Promise<boolean> {
  const res = await prisma.fixedShift.deleteMany({ where: { id } });
  return res.count > 0;
}

export interface FixedShiftPatch {
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export async function updateFixedShift(id: string, patch: FixedShiftPatch): Promise<FixedShift | null> {
  const exists = await prisma.fixedShift.findUnique({ where: { id } });
  if (!exists) return null;
  const weekdays = [...new Set(patch.weekdays)].sort((a, b) => a - b);
  const row = await prisma.fixedShift.update({
    where: { id },
    data: { weekdays, startTime: patch.startTime, endTime: patch.endTime },
  });
  return toFixed(row);
}

// === 알림 ===

export async function pushNotification(crewId: string, message: string): Promise<Notification> {
  const storeId = await requireStoreId(crewId);
  const row = await prisma.notification.create({ data: { storeId, crewId, message } });
  return { id: row.id, crewId: row.crewId, message: row.message, createdAt: row.createdAt.toISOString(), read: row.read };
}

export async function listNotifications(crewId: string): Promise<Notification[]> {
  const rows = await prisma.notification.findMany({
    where: { crewId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map((r: NotiRow) => ({
    id: r.id,
    crewId: r.crewId,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    read: r.read,
  }));
}

export async function unreadNotificationCount(crewId: string): Promise<number> {
  return prisma.notification.count({ where: { crewId, read: false } });
}

export async function markNotificationsRead(crewId: string): Promise<number> {
  const res = await prisma.notification.updateMany({ where: { crewId, read: false }, data: { read: true } });
  return res.count;
}
