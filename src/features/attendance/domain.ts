// 출퇴근 도메인 → 표현 매핑. components 에 넘길 표현값(톤/라벨) 산출.
// components 는 도메인 타입을 모르므로 이 매핑이 경계 역할을 한다(architect §1.1).

import type { AttendanceRecord, EditRequestChange, WorkStatus } from "@/types";
import { REGULAR_MINUTES, REGULAR_RANGE } from "@/lib/constants";
import { parseHHMM } from "@/lib/time";
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
 * 정산 종료 상태(결근·휴가): 더 이상 출근/퇴근 진행이 없는 확정 상태.
 * 그날은 0원 처리(attendance-rules) + 퇴근 버튼 비활성 + 홈 히어로에 상태 표기.
 * phase(시각 기반)와 독립 — 결근이어도 clockIn 시각은 남아 있어 phase 만으로는 구분 불가하므로 status 로 판정.
 */
export function isSettledStatus(status: WorkStatus | null | undefined): boolean {
  return status === "결근" || status === "휴가";
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
    case "조퇴":
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

/**
 * T15 추가 폼(AddRecordForm) 제출 가능 여부(로컬 검증, 사유 제외). 순수 O(1).
 * - 무근무(휴가/결근): 출퇴근 시각 검증 스킵 → 시간 입력 없이 즉시 제출 가능(isSettledStatus).
 * - 출근시각(clockIn) 필수: 빈값 또는 형식불량(NaN) → 불가(AC-3/E-3).
 * - 퇴근시각(clockOut) 선택(빈값 허용, Q2). 명시되면 형식 유효 + clockOut>clockIn 이어야 함(Q5/AC-11).
 *   퇴근<=출근(역전·동일)이면 불가 — route Q5 검증과 동일 정책.
 * 사유(reason) trim 검증은 EditRequestForm 이 별도로 담당하므로 여기서 제외.
 */
export function canSubmitAddRecord(i: {
  status: WorkStatus;
  clockIn: string;
  clockOut: string;
}): boolean {
  if (isSettledStatus(i.status)) return true; // 휴가/결근 → 시간 무관 제출 가능
  if (i.clockIn === "" || Number.isNaN(parseHHMM(i.clockIn))) return false;
  if (i.clockOut === "") return true; // 퇴근 선택(null 허용)
  const out = parseHHMM(i.clockOut);
  if (Number.isNaN(out)) return false;
  return out > parseHHMM(i.clockIn);
}

/**
 * T15 Q4: EditRequest 의 before 스냅샷으로 "추가" vs "수정" 파생(표시 전용, 스키마 무변경).
 * 레코드 없던 날의 추가요청은 before 가 빈 스냅샷(`{정상, null, null}`, addRequest L292)이므로 "추가".
 * 그 외(기존 clock/상태 보유)는 "수정". 휴게 범위는 판별에 불포함(추가요청은 휴게 미입력).
 */
export function requestKindLabel(before: EditRequestChange): "추가" | "수정" {
  const isEmptyBefore =
    before.clockIn === null &&
    before.clockOut === null &&
    before.status === "정상";
  return isEmptyBefore ? "추가" : "수정";
}

/** 근무시간(분) → 상세용 "N시간 M분". */
export function longWorkLabel(workMinutes: number): string {
  const h = Math.floor(workMinutes / 60);
  const m = workMinutes % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}
