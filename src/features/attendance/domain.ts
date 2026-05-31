// 출퇴근 도메인 → 표현 매핑. components 에 넘길 표현값(톤/라벨) 산출.
// components 는 도메인 타입을 모르므로 이 매핑이 경계 역할을 한다(architect §1.1).

import type { AttendanceRecord, WorkStatus } from "@/types";
import { REGULAR_MINUTES } from "@/lib/constants";
import type { Tone } from "@/lib/constants";

export interface Badge {
  text: string;
  tone: Extract<Tone, "green" | "gray">;
}

/**
 * 캘린더 배지(쟁점 A): 정규(390) 대비
 *  - 초과(연장) → 그린 +N분
 *  - 부족 → 회색 -N분
 *  - diff===0 → null(+0분 숨김)
 *  - 휴가 → null(라벨 별도)
 */
export function formatBadge(r: AttendanceRecord): Badge | null {
  if (r.status === "휴가") return null;
  const diff = r.workMinutes - REGULAR_MINUTES;
  if (diff === 0) return null;
  if (diff > 0) return { text: `+${diff}분`, tone: "green" };
  return { text: `${diff}분`, tone: "gray" };
}

/** 상태별 점 색상 토큰. */
export function statusTone(status: WorkStatus): Tone {
  switch (status) {
    case "연장":
      return "green";
    case "휴가":
      return "blue";
    case "지각":
    case "결근":
      return "coral";
    default:
      return "neutral";
  }
}

/** 근무시간(분) → 캘린더 셀 짧은 라벨 ("7h" / "6h30분"). */
export function shortWorkLabel(workMinutes: number): string {
  const h = Math.floor(workMinutes / 60);
  const m = workMinutes % 60;
  return m > 0 ? `${h}h${m}분` : `${h}h`;
}

/** 근무시간(분) → 상세용 "N시간 M분". */
export function longWorkLabel(workMinutes: number): string {
  const h = Math.floor(workMinutes / 60);
  const m = workMinutes % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}
