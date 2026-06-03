// 출퇴근·수정요청 데이터 계층(Prisma 단일 진실원). 순수 규칙(attendance-rules) 재사용.
// crewId = operationalId(데모) ?? membershipId(실멤버). 운영행 생성 시 storeId 는 멤버십에서 해석.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { storeIdForCrew } from "./identity-repo";
import type {
  ApproveResult,
  AttendanceRecord,
  ClockInStatus,
  ClockOutStatus,
  EditRequest,
  EditRequestChange,
  WorkStatus,
} from "@/types";
import {
  applyAfter,
  applyClockInStatus,
  applyClockOutStatus,
  applyStatusPolicy,
  emptyRecord,
  isAfterValid,
  newRecordFrom,
  subStatusesFromStatus,
} from "./attendance-rules";
import { calcWorkMinutes, calcOvertimeByClock } from "./time";
import { DEFAULT_BREAK_MINUTES, DEFAULT_CREW_ID } from "./constants";

type RecordRow = Prisma.AttendanceRecordGetPayload<object>;
type RequestRow = Prisma.EditRequestGetPayload<object>;

/** Prisma 행 → 도메인 AttendanceRecord. breakStart/End 는 둘 다 있을 때만 포함(도메인 optional). */
function toRecord(row: RecordRow): AttendanceRecord {
  return {
    date: row.date,
    status: row.status as WorkStatus,
    clockIn: row.clockIn,
    clockOut: row.clockOut,
    breakMinutes: row.breakMinutes,
    workMinutes: row.workMinutes,
    overtimeMinutes: row.overtimeMinutes,
    deductMinutes: row.deductMinutes,
    crewId: row.crewId,
    clockInStatus: row.clockInStatus as ClockInStatus,
    clockOutStatus: row.clockOutStatus as ClockOutStatus,
    ...(row.breakStart && row.breakEnd
      ? { breakStart: row.breakStart, breakEnd: row.breakEnd }
      : {}),
  };
}

/** 도메인 레코드 → Prisma write data(필드 공통, storeId/crewId 는 별도). 분리상태 동기화. */
function toData(rec: AttendanceRecord) {
  const sub = subStatusesFromStatus(rec.status);
  return {
    date: rec.date,
    status: rec.status,
    clockInStatus: rec.clockInStatus ?? sub.clockInStatus,
    clockOutStatus: rec.clockOutStatus ?? sub.clockOutStatus,
    clockIn: rec.clockIn,
    clockOut: rec.clockOut,
    breakMinutes: rec.breakMinutes,
    breakStart: rec.breakStart ?? null,
    breakEnd: rec.breakEnd ?? null,
    workMinutes: rec.workMinutes,
    overtimeMinutes: rec.overtimeMinutes,
    deductMinutes: rec.deductMinutes,
  };
}

function toEditRequest(row: RequestRow): EditRequest {
  return {
    id: row.id,
    date: row.date,
    reason: row.reason,
    before: row.before as unknown as EditRequestChange,
    after: row.after as unknown as EditRequestChange,
    status: row.status as EditRequest["status"],
    createdAt: row.createdAt.toISOString(),
    crewId: row.crewId,
  };
}

/** crewId 의 storeId(운영행 생성용). 없으면 throw(유효 멤버가 아님). */
async function requireStoreId(crewId: string): Promise<string> {
  const storeId = await storeIdForCrew(crewId);
  if (!storeId) throw new Error(`storeId not found for crewId=${crewId}`);
  return storeId;
}

// === 출퇴근 ===

export async function getMonthRecords(
  month: string,
  crewId: string = DEFAULT_CREW_ID,
): Promise<AttendanceRecord[]> {
  const rows = await prisma.attendanceRecord.findMany({
    where: { crewId, date: { startsWith: month } },
    orderBy: { date: "asc" },
  });
  return rows.map(toRecord);
}

export async function getRecord(
  date: string,
  crewId: string = DEFAULT_CREW_ID,
): Promise<AttendanceRecord | null> {
  const row = await prisma.attendanceRecord.findUnique({
    where: { crewId_date: { crewId, date } },
  });
  return row ? toRecord(row) : null;
}

/** 출근상태 변경(정책은 순수 applyStatusPolicy). 없으면 null. */
export async function updateStatus(
  date: string,
  status: WorkStatus,
  crewId: string = DEFAULT_CREW_ID,
): Promise<AttendanceRecord | null> {
  const row = await prisma.attendanceRecord.findUnique({
    where: { crewId_date: { crewId, date } },
  });
  if (!row) return null;
  // 단일 status 변경(레거시 호환): 분리상태도 status 에서 파생 동기화.
  const updated: AttendanceRecord = {
    ...applyStatusPolicy(toRecord(row), status),
    ...subStatusesFromStatus(status),
  };
  await prisma.attendanceRecord.update({
    where: { crewId_date: { crewId, date } },
    data: toData(updated),
  });
  return updated;
}

/** 출근 상태 변경(독립, 즉시). 없으면 null. */
export async function setClockInStatus(
  date: string,
  clockInStatus: ClockInStatus,
  crewId: string = DEFAULT_CREW_ID,
): Promise<AttendanceRecord | null> {
  const row = await prisma.attendanceRecord.findUnique({ where: { crewId_date: { crewId, date } } });
  if (!row) return null;
  const updated = applyClockInStatus(toRecord(row), clockInStatus);
  await prisma.attendanceRecord.update({
    where: { crewId_date: { crewId, date } },
    data: toData(updated),
  });
  return updated;
}

/** 퇴근 상태 변경(독립, 즉시). 없으면 null. */
export async function setClockOutStatus(
  date: string,
  clockOutStatus: ClockOutStatus,
  crewId: string = DEFAULT_CREW_ID,
): Promise<AttendanceRecord | null> {
  const row = await prisma.attendanceRecord.findUnique({ where: { crewId_date: { crewId, date } } });
  if (!row) return null;
  const updated = applyClockOutStatus(toRecord(row), clockOutStatus);
  await prisma.attendanceRecord.update({
    where: { crewId_date: { crewId, date } },
    data: toData(updated),
  });
  return updated;
}

/** 오늘 출/퇴근 시각 기록(현재 시각). 휴가/결근 → 정상 정상화. 없으면 신규 생성. */
export async function upsertTodayClock(
  date: string,
  field: "clockIn" | "clockOut",
  time: string,
  crewId: string = DEFAULT_CREW_ID,
): Promise<AttendanceRecord> {
  const prev =
    (await getRecord(date, crewId)) ??
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

  const storeId = await requireStoreId(crewId);
  await prisma.attendanceRecord.upsert({
    where: { crewId_date: { crewId, date } },
    create: { storeId, crewId, ...toData(next) },
    update: toData(next),
  });
  return next;
}

// === 수정요청 ===

/** 본인 수정요청 목록(최신순). */
export async function listRequests(crewId: string): Promise<EditRequest[]> {
  const rows = await prisma.editRequest.findMany({
    where: { crewId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toEditRequest);
}

/** 매장 멤버들의 수정요청 목록(마스터). */
export async function listRequestsForCrews(crewIds: string[]): Promise<EditRequest[]> {
  const rows = await prisma.editRequest.findMany({
    where: { crewId: { in: crewIds } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toEditRequest);
}

export interface NewEditRequest {
  date: string;
  reason: string;
  after: EditRequestChange;
  crewId?: string;
}

/** 수정요청 생성(status "대기"). before 는 현재 레코드 스냅샷. */
export async function addRequest(req: NewEditRequest): Promise<EditRequest> {
  const crewId = req.crewId ?? DEFAULT_CREW_ID;
  const existing = await getRecord(req.date, crewId);
  const before: EditRequestChange = existing
    ? {
        status: existing.status,
        clockIn: existing.clockIn,
        clockOut: existing.clockOut,
        ...(existing.breakStart && existing.breakEnd
          ? { breakStart: existing.breakStart, breakEnd: existing.breakEnd }
          : {}),
      }
    : { status: "정상", clockIn: null, clockOut: null };

  const storeId = await requireStoreId(crewId);
  const row = await prisma.editRequest.create({
    data: {
      storeId,
      crewId,
      date: req.date,
      reason: req.reason,
      before: before as unknown as Prisma.InputJsonValue,
      after: req.after as unknown as Prisma.InputJsonValue,
      status: "대기",
    },
  });
  return toEditRequest(row);
}

/**
 * 수정요청 수락(순수 applyAfter). 멱등(이미 수락이면 재반영 없음). 없으면 null.
 * 손상 after → fail-closed(레코드 미반영).
 */
export async function approveRequest(id: string): Promise<ApproveResult | null> {
  const req = await prisma.editRequest.findUnique({ where: { id } });
  if (req === null) return null;

  const after = req.after as unknown as EditRequestChange;
  const crewId = req.crewId;
  const existingRow = await prisma.attendanceRecord.findUnique({
    where: { crewId_date: { crewId, date: req.date } },
  });
  const existing = existingRow ? toRecord(existingRow) : null;

  if (req.status === "수락") {
    const record = existing ?? newRecordFrom(req.date, after);
    return { request: toEditRequest(req), record };
  }
  if (!isAfterValid(after)) {
    const record = existing ?? emptyRecord(req.date);
    return { request: toEditRequest(req), record };
  }

  const base = existing ?? newRecordFrom(req.date, after);
  const record: AttendanceRecord = {
    ...applyAfter(base, after),
    ...subStatusesFromStatus(after.status),
  };
  await prisma.attendanceRecord.upsert({
    where: { crewId_date: { crewId, date: req.date } },
    create: { storeId: req.storeId, crewId, ...toData(record) },
    update: toData(record),
  });
  const updatedReq = await prisma.editRequest.update({
    where: { id },
    data: { status: "수락" },
  });
  return { request: toEditRequest(updatedReq), record };
}

// === 집계(마스터) ===

/** 단일 멤버 month 운영 집계(근무/연장/휴가). 빈 멤버 → 0. */
export async function getCrewAggregate(
  crewId: string,
  month: string,
): Promise<{ workMinutes: number; overtimeMinutes: number; vacationDays: number }> {
  const rows = await prisma.attendanceRecord.findMany({
    where: { crewId, date: { startsWith: month } },
    select: { workMinutes: true, overtimeMinutes: true, status: true },
  });
  return {
    workMinutes: rows.reduce((s, r) => s + r.workMinutes, 0),
    overtimeMinutes: rows.reduce((s, r) => s + r.overtimeMinutes, 0),
    vacationDays: rows.filter((r) => r.status === "휴가").length,
  };
}
