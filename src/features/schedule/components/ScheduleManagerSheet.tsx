"use client";

// 스케쥴 화면에서 매니저 지정/해제 시트(마스터 전용). MasterView 토글과 동일 API 재사용.
// 매니저 = 스케쥴 작성권한 보유 멤버. 토글은 PATCH /api/master/crews/[id]/manager.
import { BottomSheet } from "@/components/BottomSheet";
import type { Crew } from "@/types";

export function ScheduleManagerSheet({
  crews,
  busyId,
  onClose,
  onToggle,
}: {
  crews: Crew[];
  busyId: string | null;
  onClose: () => void;
  onToggle: (crewId: string, on: boolean) => void;
}) {
  // 매니저 최상단 정렬.
  const crewList = crews
    .filter((c) => c.role === "crew")
    .sort((a, b) => (a.isManager ? 0 : 1) - (b.isManager ? 0 : 1) || a.id.localeCompare(b.id));
  return (
    <BottomSheet open onClose={onClose} title="매니저 지정">
      <p className="pb-3 text-xs text-muted">
        매니저는 스케쥴을 작성·수정할 수 있습니다. (마스터만 지정 가능)
      </p>
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
        {crewList.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-foreground/5 px-3 py-2.5"
          >
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-foreground/[0.06] text-sm font-bold">
              {c.avatarInitial}
              {c.isManager ? (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[9px] font-bold text-white"
                >
                  M
                </span>
              ) : null}
            </span>
            <span className="flex-1 font-semibold">
              {c.name}
              {c.isManager ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  멤버(매니저)
                </span>
              ) : null}
            </span>
            <button
              type="button"
              disabled={busyId === c.id}
              onClick={() => onToggle(c.id, !c.isManager)}
              aria-pressed={c.isManager}
              aria-label={`${c.name} 매니저 ${c.isManager ? "해제" : "지정"}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${
                c.isManager ? "bg-amber-500 text-white" : "bg-foreground/[0.06] text-muted"
              }`}
            >
              {c.isManager ? "해제" : "지정"}
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
