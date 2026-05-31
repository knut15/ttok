// 급여 도메인 → 표현 매핑. PayItem → 표현(블루행 판정, 금액 포맷).
import type { PayItem } from "@/types";

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function overtimeLabel(minutes: number): string | null {
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `연장 ${h}시간 ${m}분`;
  if (h > 0) return `연장 ${h}시간`;
  return `연장 ${m}분`;
}

export function isVacationItem(item: PayItem): boolean {
  return item.kind === "vacation";
}

/** 분 → "N시간 M분" / "N시간". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}
