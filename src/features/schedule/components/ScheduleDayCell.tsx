// 스케쥴 캘린더 셀 1칸(presentational, T19/T20-4). 날짜 + 등록된 근무자 아바타.
// 출퇴근 캘린더와 달리 Link 가 아닌 button — 탭 시 해당 날짜 편집 시트를 연다.
import type { ScheduleAssignee } from "@/types";

export interface ScheduleCellView {
  date: string;
  dayNum: number;
  assignees: ScheduleAssignee[];
}

const MAX_AVATARS = 4;

function Avatar({ a }: { a: ScheduleAssignee }) {
  // 근무=코랄, 휴무=점선 회색(시각 구분).
  return (
    <span
      title={`${a.name}${a.off ? " (휴무)" : ""}`}
      className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ${
        a.off
          ? "border border-dashed border-black/25 text-muted"
          : "bg-coral/15 text-coral"
      }`}
    >
      {a.avatarInitial}
    </span>
  );
}

export function ScheduleDayCell({
  view,
  weekendTone,
  onSelect,
}: {
  view: ScheduleCellView | null;
  weekendTone?: "sun" | "sat";
  onSelect: (date: string) => void;
}) {
  if (!view) return <div className="aspect-[3/4]" />;

  const numColor =
    weekendTone === "sun"
      ? "text-coral"
      : weekendTone === "sat"
        ? "text-statusblue"
        : "text-foreground";

  const shown = view.assignees.slice(0, MAX_AVATARS);
  const extra = view.assignees.length - shown.length;

  return (
    <button
      type="button"
      onClick={() => onSelect(view.date)}
      aria-label={`${view.dayNum}일 스케쥴 ${view.assignees.length}명`}
      className="flex aspect-[3/4] flex-col items-center gap-1 rounded-lg px-0.5 py-1 hover:bg-black/5"
    >
      <span className={`text-sm font-semibold ${numColor}`}>{view.dayNum}</span>
      {shown.length > 0 ? (
        <span className="flex flex-wrap justify-center gap-0.5">
          {shown.map((a) => (
            <Avatar key={a.crewId} a={a} />
          ))}
          {extra > 0 ? (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-black/[0.06] text-[9px] font-bold text-muted">
              +{extra}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
