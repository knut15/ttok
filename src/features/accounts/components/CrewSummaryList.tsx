// 마스터 집계 행 목록(presentational, T8-5). 멤버별 근무합계·연장·휴일수.
// 빈 멤버는 0 으로 graceful 표기(E-5, NaN/crash 방어).
// REWORK v2 / P1-2 / AC-11: 각 행을 /master/[crewId] 드릴다운 링크로 → 해당 멤버 근무/휴일 상세.
import Link from "next/link";
import type { CrewSummary } from "@/types";

/** 분 → "N시간 M분" 한글 라벨(0분이면 "0분"). */
function minutesLabel(min: number): string {
  const safe = Number.isFinite(min) ? min : 0;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

interface CrewSummaryListProps {
  crews: CrewSummary[];
  /** 매니저 지정/해제(마스터 전용). 미지정 시 토글 버튼 숨김. */
  onToggleManager?: (crewId: string, on: boolean) => void;
}

export function CrewSummaryList({ crews, onToggleManager }: CrewSummaryListProps) {
  if (crews.length === 0) {
    return (
      <p className="px-5 pt-10 text-center text-sm text-muted">
        집계할 멤버가 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2 px-5">
      {crews.map((c) => (
        // 토글 버튼은 Link 바깥 형제로 배치(중첩 인터랙티브 방지).
        <li
          key={c.crewId}
          className="flex items-center gap-2 rounded-3xl border border-black/5 bg-surface pr-3"
        >
          <Link
            href={`/master/${c.crewId}`}
            aria-label={`${c.name} 근무 상세 보기`}
            className="flex flex-1 items-center gap-3 px-4 py-3 transition active:scale-[0.99]"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.06] font-bold">
              {c.avatarInitial}
              {c.isManager ? (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[9px] font-bold text-white"
                  title="매니저"
                >
                  M
                </span>
              ) : null}
            </span>
            <div className="flex-1">
              <p className="font-semibold">
                {c.name}
                {c.isManager ? (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    멤버(매니저)
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-muted">
                근무 {minutesLabel(c.workMinutes)} · 연장{" "}
                {minutesLabel(c.overtimeMinutes)} · 휴일 {c.vacationDays}일
              </p>
            </div>
          </Link>
          {onToggleManager ? (
            <button
              type="button"
              onClick={() => onToggleManager(c.crewId, !c.isManager)}
              aria-pressed={c.isManager}
              aria-label={`${c.name} 매니저 ${c.isManager ? "해제" : "지정"}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                c.isManager
                  ? "bg-amber-500 text-white"
                  : "bg-black/[0.06] text-muted"
              }`}
            >
              {c.isManager ? "매니저 해제" : "매니저 지정"}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
