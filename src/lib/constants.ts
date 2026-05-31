// 도메인 상수 (architect §1.3, §3.1). 부수효과 없음.

import type { WorkStatus } from "@/types";

/** 정규 근무시간(분). 08:00~15:00 - 휴게 30분 = 6.5h = 390분. */
export const REGULAR_MINUTES = 390;

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

/** 출근상태 5종 enum (라디오 옵션 순서). */
export const WORK_STATUSES: readonly WorkStatus[] = [
  "정상",
  "지각",
  "결근",
  "휴가",
  "연장",
] as const;

/** 표현 톤 토큰 — components 가 도메인을 모른 채 받는 색 키. */
export type Tone = "coral" | "green" | "blue" | "gray" | "neutral";
