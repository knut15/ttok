// 인메모리 store (모듈 싱글톤, server-only). architect §2.1.
// client 직접 import 금지 — 반드시 Route Handler 경유.
// 휘발성: 서버 재시작 시 seed 로 초기화(엣지#7, 명세 동작). globalThis 가드로 dev HMR 보존.

import type { AttendanceRecord, EditRequest, WorkStatus } from "@/types";
import { buildSeedRecords } from "./seed";
import { calcWorkMinutes, calcOvertime } from "./time";
import { DEFAULT_BREAK_MINUTES } from "./constants";

interface StoreShape {
  records: Map<string, AttendanceRecord>; // key = "YYYY-MM-DD"
  requests: EditRequest[];
  seq: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __crewmonStore: StoreShape | undefined;
}

function createStore(): StoreShape {
  const records = new Map<string, AttendanceRecord>();
  for (const r of buildSeedRecords()) records.set(r.date, r);
  return { records, requests: [], seq: 1 };
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

/** 출근상태 변경(AC-8). 없으면 null. */
export function updateStatus(
  date: string,
  status: WorkStatus,
): AttendanceRecord | null {
  const store = getStore();
  const rec = store.records.get(date);
  if (!rec) return null;
  const updated: AttendanceRecord = { ...rec, status };
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
