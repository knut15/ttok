// 공용 도메인 타입 — 계약의 단일 출처 (architect §2.2).
// FE ↔ API ↔ store 가 모두 이 타입을 import 한다. leaf 모듈(의존 없음).

export type WorkStatus = "정상" | "지각" | "결근" | "휴가" | "연장";

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
  crewId?: string; // T8: 멀티크루 스코프 태그(append-only, 회귀 0). 미지정 → DEFAULT_CREW_ID.
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
  crewId?: string; // T8: 멀티크루 스코프 태그(append-only, 회귀 0). 미지정 → DEFAULT_CREW_ID.
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
}

/** PATCH 허용 필드 — 휴대폰/이메일만. name/birthDate는 타입상 표현 불가(컴파일 방어). */
export type ProfilePatch = Partial<Pick<UserProfile, "phone" | "email">>;

// === T8 계정/권한 분리 (마스터·크루) — append-only, leaf 단일출처 (architect §2.1) ===

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

/** 마스터 집계 행 — 크루별 근무/연장/휴가 요약. */
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

// === FR-2 마스터 수정요청 컨펌 (append-only, leaf) ===

/** 마스터 수정요청 목록 행 — EditRequest + 크루명(서버 조인, 폴백 crewId). */
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

/** 마스터 대타 승인 목록 행 — ScheduleEntry + 크루명(서버 조인). */
export interface MasterSubstituteRow extends ScheduleEntry {
  crewName: string;
}

/** GET /api/master/substitutes 응답. */
export interface MasterSubstitutesResponse {
  substitutes: MasterSubstituteRow[];
}

/** 요일 유형 — 매장 운영시간 구분용(평일/주말). 고정근무 요일과는 별개. */
export type DayType = "weekday" | "weekend";

/**
 * 크루별 고정 근무. crewId 당 1건. 근무 요일을 직접 선택(일~토)하고 시프트 시간을 지정.
 * 스케쥴표는 해당 요일에 명시 배정이 없으면 이 고정값을 자동 적용 → 변동만 기록.
 */
export interface FixedShift {
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
  fixedShifts: FixedShift[]; // 크루별 고정근무 설정(관리 UI용)
  canWrite: boolean; // 요청자(master/매니저) 작성 권한
}
