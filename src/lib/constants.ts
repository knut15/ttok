// 도메인 상수 (architect §1.3, §3.1). 부수효과 없음.

import type { WorkStatus } from "@/types";

/** 정규 근무시간(분). 08:00~15:00 - 휴게 30분 = 6.5h = 390분. */
export const REGULAR_MINUTES = 390;

/** 정규 종료시각(분). 15:00 = 900분. 연장은 이 시각 초과분만 인정(clockOut 기준). ADR 0001. */
export const REGULAR_END_MINUTES = 900;

/** 시급(원). 시드 기준. */
export const HOURLY_WAGE = 10320;

/** 기본 휴게(분). 11:30~12:00. */
export const DEFAULT_BREAK_MINUTES = 30;

export const DEFAULT_BREAK_RANGE = "11:30~12:00";

/** 정규 근무 기준선 표기. */
export const REGULAR_RANGE = "08:00~15:00";

export const STORE_NAME = "매머드커피 익스프레스 마석경춘로점";

export const SEED_MONTH = "2026-05";

// === 마이페이지 매장 부가정보 (append) ===
/** 시드 입사일. UI "입사 2026.04.01 ~ 재직중". */
export const SEED_JOIN_DATE = "2026-04-01";
/** 근무요일 라벨. */
export const SEED_WORK_DAYS = "월 ~ 금";
/** 근무시간 라벨. */
export const SEED_WORK_TIME = "08:00~15:00";

/** 근무상태 6종 enum (라디오 옵션 순서). 조퇴=퇴근측 상태이나 추가폼/API 통합 status 로도 선택 가능. */
export const WORK_STATUSES: readonly WorkStatus[] = [
  "정상",
  "지각",
  "결근",
  "휴가",
  "연장",
  "조퇴",
] as const;

/** 표현 톤 토큰 — components 가 도메인을 모른 채 받는 색 키. */
export type Tone = "coral" | "green" | "blue" | "gray" | "neutral";

// === T8 계정/권한 분리 상수 (append-only, architect §1.2) ===

/** 기본 멤버(김민정). store/API 인자·헤더 생략 시 fallback → 단일사용자 흐름 보존. */
export const DEFAULT_CREW_ID = "crew-minjung";

/** 마스터(점주) 계정 id. 본인 근무기록 없음(E-4). */
export const MASTER_ID = "master-1";

/** 시드 멤버 id 목록(마스터 제외). 김민정 + 멤버2/3 + 신규입사자(crew-4). */
export const CREW_IDS: readonly string[] = ["crew-minjung", "crew-2", "crew-3", "crew-4"] as const;

// === 운영시간(매장 영업시간) — 근무시간(개별 시프트)과 구분. 매니저/마스터가 이 범위 내에서 개별 등록. ===
/** 매장 운영시간. 평일 08:00~19:00 / 주말 09:00~17:00. */
export const OPERATING_HOURS = {
  weekday: { open: "08:00", close: "19:00" },
  weekend: { open: "09:00", close: "17:00" },
} as const;

/** 현재 사용자 전달 헤더 키(Q-D=헤더 방식, URL 불변 → 회귀 0). */
export const HEADER_CREW_ID = "x-crew-id";
export const HEADER_ROLE = "x-role";

/** 초대코드 생성 알파벳(혼동 문자 I/O/0/1 제외). */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** 초대코드 길이. */
export const INVITE_CODE_LENGTH = 6;
/** 초대코드 기본 만료 기간(일). 발급 시 now + 이 일수. */
export const INVITE_TTL_DAYS = 7;

// === 급여명세서 요율 (근로자 부담분) — 4대보험·세금·인센티브. PDF 스펙 기준(검산 일치). ===
/** 4대보험 요율(근로자 부담분). 장기요양은 건강보험료에 곱한다(소득 아님). */
export const INSURANCE_RATES = {
  nationalPension: 0.0475, // 국민연금 4.75%
  health: 0.03595, // 건강보험 3.595%
  longTermCare: 0.1314, // 장기요양 = 건강보험료 × 13.14%
  employment: 0.009, // 고용보험 0.9%
} as const;

/** 지방소득세 = 소득세 × 10%. */
export const LOCAL_INCOME_TAX_RATE = 0.1;

/** 인센티브 = 총매출 × 1%. */
export const INCENTIVE_RATE = 0.01;

/** 연장 단가(원/시간). 5인 미만 사업장 가산 없음 → 0(시간만 표기). */
export const OVERTIME_HOURLY_WAGE = 0;

/** 국민연금 기준소득월액 절사 단위(원). 총지급액을 이 단위로 내림 후 요율 적용. */
export const PENSION_BASE_UNIT = 1000;
