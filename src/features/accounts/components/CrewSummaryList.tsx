// 마스터 집계 카드 목록(presentational, T8-5). 멤버별 근무합계·연장·휴일수.
// 빈 멤버는 0 으로 graceful 표기(E-5, NaN/crash 방어).
// 각 멤버를 카드로 표기: 상단 신원(아바타·이름·매니저), 하단 근무/연장/휴일 3열 지표 그리드.
// 카드 전체가 /master/[crewId] 드릴다운(REWORK v2 / P1-2 / AC-11). 매니저 토글은 Link 바깥 형제(중첩 인터랙티브 방지).
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
  /** 선택 월(YYYY-MM). 드릴다운 링크에 ?month= 로 전달 → 멤버 상세가 같은 월로 진입. */
  month: string;
  /** 매니저 지정/해제(마스터 전용). 미지정 시 토글 버튼 숨김. */
  onToggleManager?: (crewId: string, on: boolean) => void;
}

/** 카드 하단 지표 1칸. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold leading-tight tabular-nums">{value}</p>
    </div>
  );
}

export function CrewSummaryList({
  crews,
  month,
  onToggleManager,
}: CrewSummaryListProps) {
  if (crews.length === 0) {
    return (
      <p className="px-5 pt-10 text-center text-sm text-muted">
        집계할 멤버가 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3 px-5">
      {crews.map((c) => (
        <li
          key={c.crewId}
          className="overflow-hidden rounded-3xl border border-foreground/5 bg-surface shadow-[0_2px_16px_rgba(82,60,40,0.06)]"
        >
          {/* 상단: 신원(드릴다운) + 매니저 토글(형제) */}
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <Link
              href={`/master/${c.crewId}?month=${month}`}
              aria-label={`${c.name} 근무 상세 보기`}
              className="flex flex-1 items-center gap-3 transition active:scale-[0.99]"
            >
              <span className="relative grid h-11 w-11 place-items-center rounded-full bg-foreground/[0.06] font-bold">
                {c.avatarInitial}
                {c.isManager ? (
                  <span
                    aria-hidden
                    title="매니저"
                    className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[9px] font-bold text-white"
                  >
                    M
                  </span>
                ) : null}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{c.name}</span>
                {c.isManager ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    멤버(매니저)
                  </span>
                ) : null}
              </span>
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
                    : "bg-foreground/[0.06] text-muted"
                }`}
              >
                {c.isManager ? "매니저 해제" : "매니저 지정"}
              </button>
            ) : null}
          </div>

          {/* 하단: 근무/연장/휴일 3열 지표 그리드(드릴다운) */}
          <Link
            href={`/master/${c.crewId}?month=${month}`}
            tabIndex={-1}
            aria-hidden
            className="mt-3 block px-4 pb-4"
          >
            <div className="grid grid-cols-3 divide-x divide-foreground/5 rounded-2xl bg-foreground/[0.03] py-3 text-center">
              <Metric label="근무" value={minutesLabel(c.workMinutes)} />
              <Metric label="연장" value={minutesLabel(c.overtimeMinutes)} />
              <Metric label="휴일" value={`${c.vacationDays}일`} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
