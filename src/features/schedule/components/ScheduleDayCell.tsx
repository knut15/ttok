// 스케쥴 캘린더 셀 1칸(presentational, T19/T20-4). 날짜 + 등록된 근무자 아바타.
// 출퇴근 캘린더와 달리 Link 가 아닌 button — 탭 시 해당 날짜 편집 시트를 연다.
// 아바타는 mockup 처럼 겹쳐진(overlapping) 원형 그레이스케일 + 초과분 "+N" 칩.
import type { ScheduleAssignee } from "@/types";

export interface ScheduleCellView {
  date: string;
  dayNum: number;
  assignees: ScheduleAssignee[];
}

const MAX_AVATARS = 3;

function Avatar({ a }: { a: ScheduleAssignee }) {
  // 색 우선순위: 휴무(흰색) > 대타(민트) > 매니저(노랑) > 고정(옅은회색) > 일반(짙은회색).
  const tone = a.off
    ? "border border-black/15 bg-white text-muted"
    : a.substitute
      ? "bg-emerald-400 text-white" // 대타 = 민트
      : a.manager
        ? "bg-amber-400 text-white" // 매니저 = 노랑
        : a.fixed
          ? "bg-neutral-300 text-neutral-700"
          : "bg-neutral-600 text-white";
  const note = a.off
    ? " (휴무)"
    : a.substitute
      ? " (대타)"
      : a.manager
        ? " (매니저)"
        : a.fixed
          ? " (고정)"
          : "";
  return (
    <span
      title={`${a.name}${note}`}
      className={`grid h-5 w-5 place-items-center rounded-full text-[8px] font-bold ring-2 ring-surface ${tone}`}
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
        // 겹쳐진 아바타 그룹: 첫 칸 외에는 음수 마진으로 포개고, 초과분은 "+N" 칩.
        <span className="flex items-center pl-1">
          {shown.map((a, i) => (
            <span key={a.crewId} className={i === 0 ? "" : "-ml-1.5"}>
              <Avatar a={a} />
            </span>
          ))}
          {extra > 0 ? (
            <span className="-ml-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-black/[0.06] px-1 text-[8px] font-bold text-muted ring-2 ring-surface">
              +{extra}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
