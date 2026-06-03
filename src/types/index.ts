// 공용 도메인 타입 — 계약의 단일 출처 (architect §2.2).
// FE ↔ API ↔ store 가 모두 이 타입을 import 한다. leaf 모듈(의존 없음).

export type WorkStatus = "정상" | "지각" | "결근" | "휴가" | "연장";

/** 출근 상태(독립): 정상/지각 + 무근무(결근/휴가). */
export type ClockInStatus = "정상" | "지각" | "결근" | "휴가";
/** 퇴근 상태(독립): 정상/연장/조퇴. */
export type ClockOutStatus = "정상" | "연장" | "조퇴";

export interface AttendanceRecord {
  date: string; // "YYYY-MM-DD"
  status: WorkStatus;
  clockIn: string | null; // "HH:MM" (휴가/결근/미출근 → null)
  clockOut: string | null; // "HH:MM"
  breakMinutes: number; // 휴게(분), 기본 30. 범위 있으면 calcBreakMinutes 파생 캐시(T7 §0 안 A)
  breakStart?: string; // 신규 optional "HH:MM" 휴게 시작 (T7 범위형)
  breakEnd?: string; // 신규 optional "HH:MM" 휴게 종료 (T7 범위형)
  workMinutes: number; // = clockOut - clockIn - break (휴가 0)
  overtimeMinutes: number; // 정규(390) 초과분, 없으면 0
  deductMinutes: number; // 급여차감(지각·결근분), 기본 0
  crewId?: string; // T8: 멀티멤버 스코프 태그(append-only, 회귀 0). 미지정 → DEFAULT_CREW_ID.
  clockInStatus?: ClockInStatus; // 출근 상태(독립). 미지정 → status 에서 파생.
  clockOutStatus?: ClockOutStatus; // 퇴근 상태(독립). 미지정 → status 에서 파생.
}

export type EditRequestStatus = "대기" | "수락";

export interface EditRequestChange {
  status: WorkStatus;
  clockIn: string | null;
  clockOut: string | null;
  breakStart?: string; // 신규 optional — 휴게 범위 편집 시에만 포함 (T7)
  breakEnd?: string; // 신규 optional (T7)
}

export interface EditRequest {
  id: string;
  date: string; // 대상 근무일
  reason: string; // 0~100자
  before: EditRequestChange;
  after: EditRequestChange;
  status: EditRequestStatus; // 생성 시 "대기"
  createdAt: string; // ISO
  crewId?: string; // T8: 멀티멤버 스코프 태그(append-only, 회귀 0). 미지정 → DEFAULT_CREW_ID.
}

/** 수락 API 응답 결합형(architect §2.2). status "수락" 전이 요청 + 재계산된 레코드. */
export interface ApproveResult {
  request: EditRequest; // status "수락"으로 전이된 요청
  record: AttendanceRecord; // after 반영 + 재계산된 레코드
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

/** 레이더(근무 안정성) 1축. score 0~100. */
export interface StabilityAxis {
  label: string;
  score: number;
  detail: string; // 실측 표기(도메인 규칙 기준): "지각 1회" / "연장 2회 · 1시간 30분" / "결근 없음" 등
}

/** 월간 급여/근태 통계(pay 페이지 헤더·레이더용). */
export interface PayMonthStats {
  hourlyWage: number; // 멤버 시급(원)
  workDays: number; // 실근무일 수(휴가·결근 제외, 근무시간>0)
  workMinutes: number; // 총 근무시간(분)
  breakMinutes: number; // 총 휴게시간(분)
  weeklyHolidayPay: number; // 주휴수당 합(원)
  basePay: number; // 근무분 급여(주휴 제외, = totalPay - weeklyHolidayPay)
  lateCount: number; // 지각
  earlyLeaveCount: number; // 조퇴
  absentCount: number; // 결근
  vacationDays: number; // 휴가
  overtimeCount: number; // 연장 회수
  overtimeMinutes: number; // 연장 합(분)
  stability: StabilityAxis[]; // 레이더 축
}

export interface PayResponse {
  summary: PaySummary;
  items: PayItem[];
  stats: PayMonthStats;
  records: AttendanceRecord[]; // 명세서 근무내역용 원본 레코드(append, 날짜 오름차순). 기존 필드 불변.
  statementInputs: PayslipInputs; // 명세서 입력값(저장값, 없으면 기본). 멤버는 이 값으로 완성본 조회.
  canEditStatement: boolean; // 요청자가 마스터인지(명세서 입력 편집 권한, 서버 판정).
}

// === 급여명세서(월별) — leaf 단일출처. lib/payslip ↔ FE 공용 계약. ===

/**
 * 명세서 입력값(도출 불가 → 마스터 입력, 멤버 읽기). 인센티브는 선택(incentiveEnabled).
 * 영속: PayslipInput(crewId, month) 단일 진실원.
 */
export interface PayslipInputs {
  incentiveEnabled: boolean; // 1% 인센티브 포함 여부(체크박스). false → 인센티브 항목 제외
  monthlySales: number; // 총매출(원) → 인센티브 = ×1% (incentiveEnabled 시에만 사용)
  incomeTax: number; // 근로소득세(간이세액표 조회값, 원)
  nightPay: number; // 야간수당(원), 기본 0
}

/**
 * 명세서 1행(지급/공제 공용). note = 산식 표기("10,320원 × 150시간10분" 등).
 * subRows = 하위 세부행(주휴 주별 5줄 / 4대보험 4종 / 소득세 2종) — 합계행 아래 들여쓰기 표기.
 */
export interface PayslipLine {
  label: string;
  amount: number;
  note?: string;
  subRows?: PayslipLine[];
}

/** 월별 급여명세서 전체. lib/payslip.buildPayslip 산출물. */
export interface Payslip {
  month: string; // "YYYY-MM"
  periodLabel: string; // "2026.05.01 ~ 2026.05.31"
  payDate: string; // 급여일/직원확인일 "YYYY-MM-DD"
  employee: { name: string; birthDate: string; company: string };
  earnings: PayslipLine[]; // 기본급/주휴(subRows=주별)/연장/야간/인센티브
  totalEarnings: number; // 총 지급액
  deductions: PayslipLine[]; // 4대보험(subRows)/소득세(subRows)
  totalDeduction: number; // 총 공제액
  netPay: number; // 실 지급액 = totalEarnings − totalDeduction
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

// === 마이페이지/프로필 (append below — leaf 모듈, FE↔API↔store 단일 출처) ===

export interface UserProfile {
  name: string; // "김민정" — 읽기전용
  birthDate: string; // "1986-04-06" — 읽기전용 (UI "1986년 4월 6일")
  phone: string; // "010-3126-7299" — 편집 가능
  email: string; // "24joy@naver.com" — 편집 가능
  avatarInitial: string; // "김"
}

export interface StoreInfo {
  name: string; // "매머드커피 익스프레스 마석경춘로점" (STORE_NAME 재사용)
  joinDate: string; // "2026-04-01" (UI "입사 2026.04.01 ~ 재직중")
  employed: boolean; // true → "재직중"
  workDays: string; // "월 ~ 금"
  workTime: string; // "08:00~15:00"
}

export interface ProfileResponse {
  profile: UserProfile;
  store: StoreInfo;
  isManager: boolean; // 현재 사용자가 매니저인지(마이페이지 표기용)
}

/** PATCH 허용 필드 — 휴대폰/이메일만. name/birthDate는 타입상 표현 불가(컴파일 방어). */
export type ProfilePatch = Partial<Pick<UserProfile, "phone" | "email">>;

// === T8 계정/권한 분리 (마스터·멤버) — append-only, leaf 단일출처 (architect §2.1) ===

/** 역할 2종. master=점주(전체 조회+수락), crew=근무자(본인 스코프). */
export type Role = "master" | "crew";

/** mock 계정 1건(서버 시드). 역할전환 목록·집계의 단위. */
export interface Crew {
  id: string;
  name: string;
  role: Role;
  avatarInitial: string;
  joinDate: string; // "YYYY-MM-DD"
  active: boolean; // 초대 합류 여부(false=미합류)
  isManager?: boolean; // T16: 마스터가 지정한 매니저(스케쥴 작성권한). master 는 항상 권한 보유.
}

/** 클라이언트가 보유하는 현재 사용자(mock 신뢰 모델). crewId는 crew일 때 본인 식별. */
export interface User {
  id: string;
  name: string;
  role: Role;
  avatarInitial: string;
  crewId?: string;
}

export type InviteStatus = "대기" | "사용";

/** 마스터가 발급하는 합류 코드. 만료/회수 미구현(mock). */
export interface Invite {
  code: string;
  createdBy: string; // masterId
  targetCrewId?: string;
  status: InviteStatus; // 대기 → 사용
  createdAt: string; // ISO
}

/** 마스터 집계 행 — 멤버별 근무/연장/휴가 요약. */
export interface CrewSummary {
  crewId: string;
  name: string;
  avatarInitial: string;
  workMinutes: number;
  overtimeMinutes: number;
  vacationDays: number;
  isManager: boolean; // T16: 매니저 지정 여부(마스터 토글용)
}

/** GET /api/master/crews 응답. */
export interface MasterSummaryResponse {
  month: string; // "YYYY-MM"
  crews: CrewSummary[];
}

/** POST /api/invites/join 성공 응답. */
export interface JoinResult {
  crew: Crew;
  ok: true;
}

/** GET /api/invites 응답 행(Prisma Invite, 마스터 관리 목록용). */
export interface StoreInvite {
  code: string;
  status: InviteStatus | "회수";
  expiresAt: string | null; // ISO
  usedByUser: string | null;
  createdAt: string; // ISO
}

// === FR-2 마스터 수정요청 컨펌 (append-only, leaf) ===

/** 마스터 수정요청 목록 행 — EditRequest + 멤버명(서버 조인, 폴백 crewId). */
export interface MasterRequestRow extends EditRequest {
  crewName: string;
}

/** GET /api/master/requests 응답. listRequests 최신순 계승. */
export interface MasterRequestsResponse {
  requests: MasterRequestRow[];
}

// === T16 스케쥴표 (append-only, leaf 단일출처) ===

/**
 * 근무 스케쥴 1건 — "근무자별 시간" 단위(근무자 1명의 하루 예정근무).
 * 한 날짜에 crewId 당 최대 1건(upsert 시 (date, crewId) 로 동일성 판정).
 * off=true 면 휴무(시간 무시). 실제 출퇴근(AttendanceRecord)과 별개의 "예정".
 */
export interface ScheduleEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  crewId: string; // 배정된 근무자
  startTime: string; // "HH:MM" (off 면 의미 없음)
  endTime: string; // "HH:MM"
  off?: boolean; // 휴무
  createdBy: string; // 작성자(master/manager) id
  source?: "manual" | "fixed"; // 출처. fixed=고정근무 자동적용(미저장 가상), 기본 manual.
  substitute?: boolean; // 대타: 고정근무 아닌데 변동(manual)으로 근무 투입(off 제외)
  approval?: "대기" | "수락"; // 대타 배정의 마스터 승인 상태(대타 entry 에만 존재)
}

/** 마스터 대타 승인 목록 행 — ScheduleEntry + 멤버명(서버 조인). */
export interface MasterSubstituteRow extends ScheduleEntry {
  crewName: string;
}

/** GET /api/master/substitutes 응답. */
export interface MasterSubstitutesResponse {
  substitutes: MasterSubstituteRow[];
}

/** 멤버 알림 1건(예: 대타 승인). */
export interface Notification {
  id: string;
  crewId: string; // 수신 멤버
  message: string;
  createdAt: string; // ISO
  read: boolean;
}

/** GET /api/notifications 응답(현재 사용자). */
export interface NotificationsResponse {
  items: Notification[];
  unread: number;
}

/** 요일 유형 — 매장 운영시간 구분용(평일/주말). 고정근무 요일과는 별개. */
export type DayType = "weekday" | "weekend";

/**
 * 멤버별 고정 근무 블록. crewId 당 여러 블록 가능(요일셋+시간 세트).
 * 예) 월~목 08:00~15:00 블록 + 일 10:00~14:00 블록(시간 다름).
 * 한 멤버의 블록들은 요일이 겹치지 않는다(요일당 최대 1블록). 명시 배정 없으면 자동 적용.
 */
export interface FixedShift {
  id: string;
  crewId: string;
  weekdays: number[]; // 0=일 … 6=토 (선택 요일)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

/** 달력 셀 아바타용 경량 배정 정보(crew 메타 조인). */
export interface ScheduleAssignee {
  crewId: string;
  name: string;
  avatarInitial: string;
  off: boolean;
  fixed: boolean; // 고정근무 자동적용분(명시 배정 아님)
  manager: boolean; // 매니저(달력 노란색)
  substitute: boolean; // 대타(달력 민트색)
}

/** GET /api/schedule 응답(월간). canWrite 로 클라가 작성 UI 노출 여부 결정(서버 판정). */
export interface ScheduleResponse {
  month: string; // "YYYY-MM"
  entries: ScheduleEntry[]; // 명시 배정 + 고정근무 자동적용(source 로 구분)
  fixedShifts: FixedShift[]; // 멤버별 고정근무 설정(관리 UI용)
  canWrite: boolean; // 요청자(master/매니저) 작성 권한
}
