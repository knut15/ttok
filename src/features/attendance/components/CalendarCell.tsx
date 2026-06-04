// 캘린더 셀 1칸(presentational). 배지 +0분 숨김 규칙은 domain.formatBadge 가 적용.
import Link from "next/link";
import type { Tone } from "@/lib/constants";

export interface CellView {
  date: string;
  dayNum: number;
  workLabel: string | null; // "7h" / null
  badge: { text: string; tone: Extract<Tone, "green" | "gray"> } | null;
  vacation: boolean;
  dotTone: Tone | null;
}

const BADGE_BG: Record<"green" | "gray", string> = {
  green: "bg-statusgreen text-white",
  gray: "bg-graybadge text-white",
};

export function CalendarCell({
  view,
  weekendTone,
}: {
  view: CellView | null;
  weekendTone?: "sun" | "sat";
}) {
  if (!view) return <div className="aspect-[3/4]" />;

  const numColor =
    weekendTone === "sun"
      ? "text-coral"
      : weekendTone === "sat"
        ? "text-statusblue"
        : "text-foreground";

  return (
    <Link
      href={`/attendance/${view.date}`}
      className="flex aspect-[3/4] flex-col items-center gap-1 rounded-lg px-0.5 py-1 hover:bg-foreground/5"
    >
      <span className={`text-sm font-semibold ${numColor}`}>{view.dayNum}</span>
      {view.badge && (
        <span
          className={`rounded-md px-1 text-[9px] font-bold leading-tight ${BADGE_BG[view.badge.tone]}`}
        >
          {view.badge.text}
        </span>
      )}
      {view.vacation ? (
        <span className="rounded-md bg-foreground/5 px-1 text-[10px] font-semibold text-muted">
          휴가
        </span>
      ) : view.workLabel ? (
        <span className="text-[10px] text-muted">{view.workLabel}</span>
      ) : null}
    </Link>
  );
}
