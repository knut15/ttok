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

/** "2026-05" → "2026년 5월". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** 현재 시각 → "HH:MM" (쟁점 C, client). */
export function nowHHMM(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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
