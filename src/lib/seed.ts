// 2026-05 시드 데이터 (server-only). architect §3.3 명시 테이블.
// 불변식(seed.test.ts 강제): 차감Σ=440 / 연장 6회·Σ544분 / totalPay=Σitems(주휴 67,080 포함).
// 배지 표기값 vs summary 충돌 시 summary 제약 우선(승인 §0, architect §5).

import type {
  AttendanceRecord,
  Crew,
  FixedShift,
  Invite,
  PayItem,
  ScheduleEntry,
  StoreInfo,
  UserProfile,
  WorkStatus,
} from "@/types";
import {
  DEFAULT_BREAK_MINUTES,
  DEFAULT_BREAK_RANGE,
  DEFAULT_CREW_ID,
  HOURLY_WAGE,
  MASTER_ID,
  SEED_MONTH,
  SEED_JOIN_DATE,
  SEED_WORK_DAYS,
  SEED_WORK_TIME,
  STORE_NAME,
} from "./constants";
import { calcPaidMinutes, calcDailyPay, calcWeeklyHolidayPay, weeklyHolidayPaidMinutes } from "./pay";
import { weekStartMonday } from "./date";

interface SeedRow {
  day: string; // "DD"
  status: WorkStatus;
  clockIn: string | null;
  clockOut: string | null;
  workMinutes: number;
  overtimeMinutes: number;
  deductMinutes: number;
}

// 명시 시드 테이블 (자의적 구성 금지). 합산값은 seed.test.ts 로 강제.
const SEED_ROWS: SeedRow[] = [
  // 정규 근무일 (work 390)
  { day: "01", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  // 연장일 6회 (overtime 합 544 = 34+90+90+80+130+120)
  { day: "04", status: "연장", clockIn: "07:26", clockOut: "15:00", workMinutes: 424, overtimeMinutes: 34, deductMinutes: 0 },
  // 지각/결근(차감) 합 440 = 90+50+300
  { day: "05", status: "지각", clockIn: "09:30", clockOut: "15:00", workMinutes: 300, overtimeMinutes: 0, deductMinutes: 90 },
  { day: "06", status: "연장", clockIn: "08:00", clockOut: "16:30", workMinutes: 480, overtimeMinutes: 90, deductMinutes: 0 },
  { day: "07", status: "연장", clockIn: "08:00", clockOut: "16:30", workMinutes: 480, overtimeMinutes: 90, deductMinutes: 0 },
  { day: "08", status: "연장", clockIn: "08:00", clockOut: "16:20", workMinutes: 470, overtimeMinutes: 80, deductMinutes: 0 },
  { day: "11", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "12", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "13", status: "지각", clockIn: "08:50", clockOut: "15:00", workMinutes: 340, overtimeMinutes: 0, deductMinutes: 50 },
  { day: "14", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "15", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "18", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "19", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "20", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "21", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "22", status: "결근", clockIn: "13:00", clockOut: "15:00", workMinutes: 90, overtimeMinutes: 0, deductMinutes: 300 },
  // 5/24(일) 특별근무 8h40m + 주휴 (IMG_3611)
  { day: "24", status: "연장", clockIn: "07:00", clockOut: "16:00", workMinutes: 520, overtimeMinutes: 130, deductMinutes: 0 },
  { day: "25", status: "연장", clockIn: "08:00", clockOut: "17:00", workMinutes: 510, overtimeMinutes: 120, deductMinutes: 0 },
  { day: "26", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "27", status: "정상", clockIn: "08:00", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  // 5/28 실근무 인정: 07:58~15:00 = 422분, 휴게30 차감 → 392분(조기출근분 정규 인정). 정시 퇴근이라 연장 0.
  { day: "28", status: "정상", clockIn: "07:58", clockOut: "15:00", workMinutes: 392, overtimeMinutes: 0, deductMinutes: 0 },
  // 휴가일
  { day: "29", status: "휴가", clockIn: null, clockOut: null, workMinutes: 0, overtimeMinutes: 0, deductMinutes: 0 },
];


// === 마이페이지 시드 (append) ===

/** 근무자 프로필 시드(김민정). 휴대폰/이메일만 편집 가능, 이름/생년월일 읽기전용. */
export function buildSeedProfile(): UserProfile {
  return {
    name: "김민정",
    birthDate: "1986-04-06",
    phone: "010-3126-7299",
    email: "24joy@naver.com",
    avatarInitial: "김",
  };
}

/** 소속 매장 시드(매머드커피). STORE_NAME 재사용. */
export const SEED_STORE_INFO: StoreInfo = {
  name: STORE_NAME,
  joinDate: SEED_JOIN_DATE,
  employed: true,
  workDays: SEED_WORK_DAYS,
  workTime: SEED_WORK_TIME,
};

// T7: 근무일 휴게 범위(11:30~12:00) — 파생 30분 = DEFAULT_BREAK_MINUTES(회귀 0, architect §3.4).
const [SEED_BREAK_START, SEED_BREAK_END] = DEFAULT_BREAK_RANGE.split("~");

export function buildSeedRecords(): AttendanceRecord[] {
  return SEED_ROWS.map((r) => ({
    date: `${SEED_MONTH}-${r.day}`,
    status: r.status,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    breakMinutes: r.status === "휴가" ? 0 : DEFAULT_BREAK_MINUTES,
    // 휴가일은 범위 미부여(breakMinutes 0 유지). 그 외엔 11:30~12:00 → 파생 30 = 기존값.
    ...(r.status === "휴가"
      ? {}
      : { breakStart: SEED_BREAK_START, breakEnd: SEED_BREAK_END }),
    workMinutes: r.workMinutes,
    overtimeMinutes: r.overtimeMinutes,
    deductMinutes: r.deductMinutes,
  }));
}

// === T8 멀티멤버 시드 (append-only). 김민정 외 멤버는 불변식 강제 없음(AC-3: 0건 이상 + 본인 격리). ===

/**
 * mock 계정 시드: 마스터 1 + 멤버 4(김민정=DEFAULT_CREW_ID 포함). architect §2.1.
 * T16: 김민정을 매니저로 지정(isManager) — 스케쥴 작성권한 시연용 시드.
 * 신규입사자(crew-4=최유진, 2026-06 입사): 근무기록 없음(0건), 6월 스케쥴부터 배정.
 */
export function buildSeedCrews(): Crew[] {
  return [
    { id: MASTER_ID, name: "박점주", role: "master", avatarInitial: "박", joinDate: "2026-03-01", active: true },
    { id: DEFAULT_CREW_ID, name: "김민정", role: "crew", avatarInitial: "김", joinDate: SEED_JOIN_DATE, active: true, isManager: true },
    { id: "crew-2", name: "이서연", role: "crew", avatarInitial: "이", joinDate: "2026-04-15", active: true },
    { id: "crew-3", name: "박지훈", role: "crew", avatarInitial: "박", joinDate: "2026-05-02", active: true },
    { id: "crew-4", name: "최유진", role: "crew", avatarInitial: "최", joinDate: "2026-06-01", active: true },
  ];
}

// 멤버2/3 간단 mock 근무기록(각자 다른 데이터, 불변식 강제 없음).
const CREW_2_ROWS: SeedRow[] = [
  { day: "07", status: "정상", clockIn: "09:00", clockOut: "18:00", workMinutes: 510, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "08", status: "정상", clockIn: "09:00", clockOut: "18:00", workMinutes: 510, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "09", status: "지각", clockIn: "09:40", clockOut: "18:00", workMinutes: 470, overtimeMinutes: 0, deductMinutes: 40 },
  { day: "14", status: "휴가", clockIn: null, clockOut: null, workMinutes: 0, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "15", status: "정상", clockIn: "09:00", clockOut: "18:00", workMinutes: 510, overtimeMinutes: 0, deductMinutes: 0 },
];

const CREW_3_ROWS: SeedRow[] = [
  { day: "02", status: "정상", clockIn: "10:00", clockOut: "16:00", workMinutes: 330, overtimeMinutes: 0, deductMinutes: 0 },
  { day: "03", status: "연장", clockIn: "10:00", clockOut: "19:00", workMinutes: 510, overtimeMinutes: 240, deductMinutes: 0 },
  { day: "10", status: "결근", clockIn: null, clockOut: null, workMinutes: 0, overtimeMinutes: 0, deductMinutes: 360 },
];

/** SeedRow[] → records Map. 휴가일 휴게 0(범위 미부여), 그 외 기본 휴게 30 + 범위. crewId 태그. */
function rowsToMap(rows: SeedRow[], crewId: string): Map<string, AttendanceRecord> {
  const map = new Map<string, AttendanceRecord>();
  for (const r of rows) {
    map.set(`${SEED_MONTH}-${r.day}`, {
      date: `${SEED_MONTH}-${r.day}`,
      status: r.status,
      clockIn: r.clockIn,
      clockOut: r.clockOut,
      breakMinutes: r.status === "휴가" ? 0 : DEFAULT_BREAK_MINUTES,
      ...(r.status === "휴가"
        ? {}
        : { breakStart: SEED_BREAK_START, breakEnd: SEED_BREAK_END }),
      workMinutes: r.workMinutes,
      overtimeMinutes: r.overtimeMinutes,
      deductMinutes: r.deductMinutes,
      crewId,
    });
  }
  return map;
}

/**
 * 멤버별 records Map. 김민정은 기존 buildSeedRecords() 재사용(바이트 동일, 회귀 0 — AC-2).
 * 멤버2/3 는 간단 mock(다른 데이터, AC-3). architect §2.2.
 */
export function buildSeedRecordsByCrew(): Map<string, Map<string, AttendanceRecord>> {
  const byCrew = new Map<string, Map<string, AttendanceRecord>>();
  const minjung = new Map<string, AttendanceRecord>();
  for (const r of buildSeedRecords()) minjung.set(r.date, r);
  byCrew.set(DEFAULT_CREW_ID, minjung);
  byCrew.set("crew-2", rowsToMap(CREW_2_ROWS, "crew-2"));
  byCrew.set("crew-3", rowsToMap(CREW_3_ROWS, "crew-3"));
  return byCrew;
}

/** 초대 시드(mock). 초기 빈 배열 — 마스터가 런타임에 생성. */
export function buildSeedInvites(): Invite[] {
  return [];
}

/**
 * 고정 근무 시드(예시). 멤버당 여러 (요일셋+시간) 블록 가능.
 * 김민정 = 월~목 08:00~11:00 + 일 10:00~14:00(시간 다름), 이서연 = 금·토 11:00~17:00.
 */
export function buildSeedFixedShifts(): FixedShift[] {
  return [
    { id: "fix-seed-1", crewId: DEFAULT_CREW_ID, weekdays: [1, 2, 3, 4], startTime: "08:00", endTime: "11:00" },
    { id: "fix-seed-2", crewId: DEFAULT_CREW_ID, weekdays: [0], startTime: "10:00", endTime: "14:00" },
    { id: "fix-seed-3", crewId: "crew-2", weekdays: [5, 6], startTime: "11:00", endTime: "17:00" },
  ];
}

// === T16/T20 스케쥴 시드. 5월 샘플 + 6월 랜덤 채움. 작성자=마스터. ===
// 운영시간(평일 08~19 / 주말 09~17) 내에서 근무자별 "개별 시프트" 를 배정한다(근무시간≠운영시간).

interface SeedSchedule {
  day: string; // "DD"
  crewId: string;
  startTime: string;
  endTime: string;
  off?: boolean;
}

const SEED_SCHEDULE_ROWS: SeedSchedule[] = [
  { day: "07", crewId: DEFAULT_CREW_ID, startTime: "08:00", endTime: "15:00" },
  { day: "07", crewId: "crew-2", startTime: "09:00", endTime: "18:00" },
  { day: "08", crewId: DEFAULT_CREW_ID, startTime: "08:00", endTime: "15:00" },
  { day: "08", crewId: "crew-3", startTime: "00:00", endTime: "00:00", off: true },
  { day: "09", crewId: "crew-2", startTime: "09:00", endTime: "18:00" },
  { day: "09", crewId: "crew-3", startTime: "13:00", endTime: "22:00" },
];

// 6월 랜덤 채움 대상 — 신규입사자(crew-4) 포함 전 근무자.
const SCHEDULE_CREW_POOL = [DEFAULT_CREW_ID, "crew-2", "crew-3", "crew-4"];
const SCHEDULE_FILL_MONTH = "2026-06";

// 운영시간 내 개별 시프트 템플릿(오픈/미들/마감 등). 근무자마다 다른 시프트를 배정.
const WEEKDAY_SHIFTS: [string, string][] = [
  ["08:00", "15:00"], ["12:00", "19:00"], ["08:00", "13:00"],
  ["14:00", "19:00"], ["10:00", "17:00"], ["09:00", "18:00"],
];
const WEEKEND_SHIFTS: [string, string][] = [
  ["09:00", "14:00"], ["12:00", "17:00"], ["09:00", "17:00"], ["13:00", "17:00"],
];

/** 결정적 PRNG(mulberry32) — 시드 고정 → 재시작·테스트 간 동일 채움(매 새로고침 셔플 방지). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function isWeekend(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

/** 6월: 각 날짜에 1~3명 랜덤 배정 + 운영시간 내 개별 시프트 템플릿. */
function buildFillSchedules(startId: number): {
  entries: ScheduleEntry[];
  nextId: number;
} {
  const rng = mulberry32(20260601);
  const entries: ScheduleEntry[] = [];
  let id = startId;
  const total = daysInMonth(SCHEDULE_FILL_MONTH); // 30
  for (let day = 1; day <= total; day++) {
    const date = `${SCHEDULE_FILL_MONTH}-${String(day).padStart(2, "0")}`;
    const shifts = isWeekend(date) ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    // 풀 셔플(Fisher–Yates) 후 1~3명 선택(하루 최대 3인).
    const pool = [...SCHEDULE_CREW_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const count = 1 + Math.floor(rng() * 3);
    for (const crewId of pool.slice(0, count)) {
      const [startTime, endTime] = shifts[Math.floor(rng() * shifts.length)];
      entries.push({ id: `sch-seed-${id++}`, date, crewId, startTime, endTime, createdBy: MASTER_ID });
    }
  }
  return { entries, nextId: id };
}

/**
 * 스케쥴 시드 → Map<date, ScheduleEntry[]>. id 는 결정적(`sch-seed-N`) — 런타임 생성(`sch-N`)과 분리.
 * 5월 샘플 + 6월 랜덤 채움(운영시간 내 개별 시프트). 작성자=마스터.
 */
export function buildSeedSchedules(): Map<string, ScheduleEntry[]> {
  const byDate = new Map<string, ScheduleEntry[]>();
  const push = (entry: ScheduleEntry) => {
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  };

  let id = 1;
  // 5월 샘플(기존 데모 유지).
  for (const row of SEED_SCHEDULE_ROWS) {
    push({
      id: `sch-seed-${id++}`,
      date: `${SEED_MONTH}-${row.day}`,
      crewId: row.crewId,
      startTime: row.startTime,
      endTime: row.endTime,
      createdBy: MASTER_ID,
      ...(row.off ? { off: true } : {}),
    });
  }
  // 6월 랜덤 채움.
  for (const entry of buildFillSchedules(id).entries) push(entry);
  return byDate;
}

/** 분 → "N시간 M분" 한글 라벨. */
function minutesLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/**
 * 레코드 → 급여 item 목록 + 주휴 블루행. architect §2.2 PayItem 계약.
 * 주휴 블루행은 해당 레코드 집합이 주휴 발생 월을 포함할 때만 추가(빈 달 격리).
 */
export function buildPayItems(records: AttendanceRecord[], hourlyWage: number = HOURLY_WAGE): PayItem[] {
  if (records.length === 0) return [];
  const items: PayItem[] = records.map((r) => {
    if (r.status === "휴가") {
      return {
        date: r.date,
        kind: "vacation",
        label: "휴가",
        amount: 0,
        overtimeMinutes: 0,
        isWeeklyHoliday: false,
      };
    }
    const paid = calcPaidMinutes({
      workMinutes: r.workMinutes,
      deductMinutes: r.deductMinutes,
      status: r.status,
    });
    return {
      date: r.date,
      kind: "work",
      label: minutesLabel(r.workMinutes),
      amount: calcDailyPay({ paidMinutes: paid, hourlyWage, status: r.status }),
      overtimeMinutes: r.overtimeMinutes,
      isWeeklyHoliday: false,
    };
  });

  // 주휴수당: 1주 총 근로시간 기준으로 주 단위 산정(주 월요일 기준 그룹).
  // 주 15시간 미만 → 미발생. 15~40h → (시간/40)×8h, 40h↑ → 8h 상한. 시급 곱해 금액.
  const weekly = new Map<string, { workMinutes: number; lastDate: string }>();
  for (const r of records) {
    if (r.status === "휴가" || r.workMinutes <= 0) continue;
    const key = weekStartMonday(r.date);
    const acc = weekly.get(key) ?? { workMinutes: 0, lastDate: r.date };
    acc.workMinutes += r.workMinutes;
    if (r.date > acc.lastDate) acc.lastDate = r.date;
    weekly.set(key, acc);
  }
  for (const { workMinutes, lastDate } of weekly.values()) {
    const amount = calcWeeklyHolidayPay({ weeklyWorkMinutes: workMinutes, hourlyWage });
    if (amount <= 0) continue; // 주 15시간 미만 → 주휴 없음
    items.push({
      date: lastDate, // 해당 주의 마지막 근무일에 주휴행 표기(월 범위 내)
      kind: "weekly_holiday",
      label: `주휴수당 ${minutesLabel(weeklyHolidayPaidMinutes(workMinutes))}`,
      amount,
      overtimeMinutes: 0,
      isWeeklyHoliday: true,
    });
  }

  return items;
}
