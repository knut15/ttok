// 공용 도메인 타입 — 계약의 단일 출처 (architect §2.2).
// FE ↔ API ↔ store 가 모두 이 타입을 import 한다. leaf 모듈(의존 없음).

export type WorkStatus = "정상" | "지각" | "결근" | "휴가" | "연장";

export interface AttendanceRecord {
  date: string; // "YYYY-MM-DD"
  status: WorkStatus;
  clockIn: string | null; // "HH:MM" (휴가/결근/미출근 → null)
  clockOut: string | null; // "HH:MM"
  breakMinutes: number; // 휴게(분), 기본 30
  workMinutes: number; // = clockOut - clockIn - break (휴가 0)
  overtimeMinutes: number; // 정규(390) 초과분, 없으면 0
  deductMinutes: number; // 급여차감(지각·결근분), 기본 0
}

export type EditRequestStatus = "대기" | "수락";

export interface EditRequestChange {
  status: WorkStatus;
  clockIn: string | null;
  clockOut: string | null;
}

export interface EditRequest {
  id: string;
  date: string; // 대상 근무일
  reason: string; // 0~100자
  before: EditRequestChange;
  after: EditRequestChange;
  status: EditRequestStatus; // 생성 시 "대기"
  createdAt: string; // ISO
}

export type PayItemKind = "work" | "vacation" | "weekly_holiday"; // 근무/휴가/주휴

export interface PayItem {
  date: string;
  kind: PayItemKind;
  label: string; // "6시간 30분" | "휴가" | "주휴수당 6시간 30분"
  amount: number; // 일급(원). 휴가=0
  overtimeMinutes: number; // 연장표기용(없으면 0)
  isWeeklyHoliday: boolean; // true → 블루행 (쟁점 B)
}

export interface PaySummary {
  totalPay: number; // = Σ items.amount (주휴 포함) — AC-10 검산 불변식
  deductMinutes: number; // 시드 합산 = 440 (AC-17)
  overtimeCount: number; // = 6 (AC-17)
  overtimeMinutes: number; // = 544 (= 9시간4분) (AC-17)
}

export interface PayResponse {
  summary: PaySummary;
  items: PayItem[];
}

export interface PayDetail {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hourlyWage: number;
  paidMinutes: number; // 급여인정시간(분)
  breakMinutes: number;
  breakRange: string | null; // "11:30~12:00"
  deductMinutes: number;
  overtimeMinutes: number;
  amount: number;
}
