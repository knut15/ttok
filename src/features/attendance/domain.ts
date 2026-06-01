// 출퇴근 도메인 → 표현 매핑. components 에 넘길 표현값(톤/라벨) 산출.
// components 는 도메인 타입을 모르므로 이 매핑이 경계 역할을 한다(architect §1.1).

import type { AttendanceRecord, WorkStatus } from "@/types";
import { REGULAR_MINUTES, REGULAR_RANGE } from "@/lib/constants";
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

/** 출퇴근 토글/FAB 공용 phase 타입(단일 진실원). */
export type ClockPhase = "before" | "working" | "done";

/**
 * 오늘 레코드 → 출퇴근 phase 인지(AC-3~5). ClockToggle 인라인 로직 1:1 이관.
 *  - !clockIn → before(미출근, "출근")
 *  - clockIn && !clockOut → working(근무중, "퇴근")
 *  - clockIn && clockOut → done(마감, 비활성)
 */
export function clockPhase(record: AttendanceRecord | null): ClockPhase {
  if (!record?.clockIn) return "before";
  if (!record?.clockOut) return "working";
  return "done";
}

/**
 * 홈 진행바 우측 % 라벨 노출 여부.
 *  - done(퇴근 완료) → true
 *  - before / working → false(미출근·근무중에는 % 숨김)
 */
export function shouldShowPercent(phase: ClockPhase): boolean {
  return phase === "done";
}

/**
 * 홈 진행바 좌측 라벨(T13). 실제 출퇴근 시각으로 표기.
 *  - before / clockIn 없음 → 정규시간 placeholder("08:00 ~ 15:00")
 *  - working(clockIn O, clockOut X) → "${clockIn} ~"(퇴근 미정)
 *  - done(clockIn & clockOut) → "${clockIn} ~ ${clockOut}"
 */
export function clockRangeLabel(
  record: AttendanceRecord | null,
  phase: ClockPhase,
): string {
  if (phase === "before" || !record?.clockIn) {
    return REGULAR_RANGE.replace("~", " ~ ");
  }
  if (phase === "working" || !record.clockOut) {
    return `${record.clockIn} ~`;
  }
  return `${record.clockIn} ~ ${record.clockOut}`;
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
