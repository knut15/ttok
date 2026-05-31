// 근무/연장 시간 계산 — 순수 함수 (부수효과 0, store 비의존). architect §3.1.

import { REGULAR_MINUTES } from "./constants";

/** "HH:MM" → 분(0~1439). 형식 불량·범위 초과(시>23·분>59) → NaN. */
export function parseHHMM(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

/** 분 → "HH:MM". */
export function formatHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function calcWorkMinutes(i: {
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
}): number {
  const start = parseHHMM(i.clockIn);
  const end = parseHHMM(i.clockOut);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.max(0, end - start - i.breakMinutes);
}

/** 정규 근무시간 초과분(분). 없으면 0. */
export function calcOvertime(
  workMinutes: number,
  regular: number = REGULAR_MINUTES,
): number {
  return Math.max(0, workMinutes - regular);
}
