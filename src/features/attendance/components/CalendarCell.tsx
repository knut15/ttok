// 캘린더 셀 1칸(presentational). 배지 +0분 숨김 규칙은 domain.formatBadge 가 적용.
import Link from "next/link";

export interface CellView {
  date: string;
  dayNum: number;
  clockIn: string | null; // 정상 근무 출근시각 "08:00"
  clockOut: string | null; // 퇴근시각 "15:00"(근무중이면 null)
  statusLabel: string | null; // 지각/결근/휴가/조퇴/연장 → 상태명
  statusColor: string | null; // 상태 라벨 색(tailwind text-*)
}

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
      {view.clockIn ? (
        <span className="text-[9px] leading-tight text-muted">
          {view.clockIn}~{view.clockOut ?? ""}
        </span>
      ) : null}
      {view.statusLabel ? (
        <span
          className={`rounded-md bg-foreground/5 px-1 text-[10px] font-semibold ${view.statusColor ?? "text-muted"}`}
        >
          {view.statusLabel}
        </span>
      ) : null}
    </Link>
  );
}
