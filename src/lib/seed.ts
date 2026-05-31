// 2026-05 시드 데이터 (server-only). architect §3.3 명시 테이블.
// 불변식(seed.test.ts 강제): 차감Σ=440 / 연장 6회·Σ544분 / totalPay=Σitems(주휴 67,080 포함).
// 배지 표기값 vs summary 충돌 시 summary 제약 우선(승인 §0, architect §5).

import type {
  AttendanceRecord,
  PayItem,
  StoreInfo,
  UserProfile,
  WorkStatus,
} from "@/types";
import {
  DEFAULT_BREAK_MINUTES,
  HOURLY_WAGE,
  SEED_MONTH,
  SEED_JOIN_DATE,
  SEED_WORK_DAYS,
  SEED_WORK_TIME,
  STORE_NAME,
} from "./constants";
import { calcPaidMinutes, calcDailyPay } from "./pay";

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
  { day: "28", status: "정상", clockIn: "07:58", clockOut: "15:00", workMinutes: 390, overtimeMinutes: 0, deductMinutes: 0 },
  // 휴가일
  { day: "29", status: "휴가", clockIn: null, clockOut: null, workMinutes: 0, overtimeMinutes: 0, deductMinutes: 0 },
];

/** 주휴수당 고정 레코드(쟁점 B): 5/24 블루행, 67,080원. 산식 미구현. */
export const WEEKLY_HOLIDAY = {
  date: "2026-05-24",
  paidMinutes: 390,
  amount: 67080,
} as const;

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

export function buildSeedRecords(): AttendanceRecord[] {
  return SEED_ROWS.map((r) => ({
    date: `${SEED_MONTH}-${r.day}`,
    status: r.status,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    breakMinutes: r.status === "휴가" ? 0 : DEFAULT_BREAK_MINUTES,
    workMinutes: r.workMinutes,
    overtimeMinutes: r.overtimeMinutes,
    deductMinutes: r.deductMinutes,
  }));
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
export function buildPayItems(records: AttendanceRecord[]): PayItem[] {
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
      amount: calcDailyPay({ paidMinutes: paid, hourlyWage: HOURLY_WAGE, status: r.status }),
      overtimeMinutes: r.overtimeMinutes,
      isWeeklyHoliday: false,
    };
  });

  const weeklyMonth = WEEKLY_HOLIDAY.date.slice(0, 7);
  if (records.some((r) => r.date.startsWith(weeklyMonth))) {
    items.push({
      date: WEEKLY_HOLIDAY.date,
      kind: "weekly_holiday",
      label: `주휴수당 ${minutesLabel(WEEKLY_HOLIDAY.paidMinutes)}`,
      amount: WEEKLY_HOLIDAY.amount,
      overtimeMinutes: 0,
      isWeeklyHoliday: true,
    });
  }

  return items;
}
