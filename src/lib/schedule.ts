// 스케쥴 도메인 헬퍼 — 순수 함수(부수효과 0). 운영시간 ↔ 날짜 매핑.
import { OPERATING_HOURS } from "./constants";
import type { DayType } from "@/types";

/** 주말(토/일) 여부. 로컬 시각 기준(파싱 tz 이슈 회피용 명시 생성). */
export function isWeekendDate(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0=일, 6=토
  return day === 0 || day === 6;
}

/** 날짜 → 요일유형(평일/주말). 고정근무 매칭 키. */
export function getDayType(date: string): DayType {
  return isWeekendDate(date) ? "weekend" : "weekday";
}

/** 요일유형의 매장 운영시간. */
export function getOperatingHoursByType(dayType: DayType): { open: string; close: string } {
  return dayType === "weekend" ? OPERATING_HOURS.weekend : OPERATING_HOURS.weekday;
}

/** 해당 날짜의 매장 운영시간(평일/주말). 근무시간(개별 시프트)은 이 범위 내에서 등록. */
export function getOperatingHours(date: string): { open: string; close: string } {
  return getOperatingHoursByType(getDayType(date));
}
