// 날짜 표시/검증 유틸 (순수). isomorphic.

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "YYYY-MM-DD" 형식 + 실제 유효일자 검증(엣지#5). 2026-05-99 거부. */
export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

export function weekdayKo(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAY_KO[new Date(y, m - 1, d).getDay()];
}

/** "2026-05-29" → "2026.05.29 금" (홈 헤더 형식, AC-11). */
export function formatDotDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}.${m}.${d} ${weekdayKo(date)}`;
}

/** "2026-05-04" → "2026년 5월 4일 월" (상세 타이틀). */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 ${weekdayKo(date)}`;
}

/** "2026-05-28" → "5월 28일(목)" (급여 리스트 행). */
export function formatPayRowDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일(${weekdayKo(date)})`;
}

/** "1986-04-06" → "1986년 4월 6일" (요일 없음 — 생년월일 표기, AC-12). */
export function formatBirthDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

/** "2026-05" → "2026년 5월". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** 현재 시각 → "HH:MM" (쟁점 C, client). */
export function nowHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** "YYYY-MM" 을 delta 개월 이동. 연도 경계 자동 보정(2026-12 +1 → 2027-01). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * "YYYY-MM-DD" 를 delta 일 이동. 월/연/윤년 경계 자동 정규화.
 * 입출력 모두 zero-pad "YYYY-MM-DD". shiftMonth 미러(로컬 Date(y, m-1, d) 컨벤션 — UTC 파싱 회피).
 * 순수 — Date.now 비의존(AC-5).
 */
export function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * "YYYY-MM" start~end(포함) 오름차순 목록. start>end 면 빈 배열.
 * "YYYY-MM" 사전식 비교 = 시간순(zero-pad 보장). shiftMonth 단조증가로 종료(무한루프 없음).
 */
export function monthsBetween(start: string, end: string): string[] {
  const list: string[] = [];
  let cur = start;
  while (cur <= end) {
    list.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return list;
}

/** 월 그리드 빌드: 6주(42칸) 또는 필요한 만큼. 앞쪽 공백 + 일자. */
export function buildMonthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = first.getDay(); // 일요일 시작
  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
