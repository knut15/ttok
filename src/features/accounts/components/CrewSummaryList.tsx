// 마스터 집계 행 목록(presentational, T8-5). 크루별 근무합계·연장·휴일수.
// 빈 크루는 0 으로 graceful 표기(E-5, NaN/crash 방어).
// REWORK v2 / P1-2 / AC-11: 각 행을 /master/[crewId] 드릴다운 링크로 → 해당 크루 근무/휴일 상세.
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

export function CrewSummaryList({ crews }: { crews: CrewSummary[] }) {
  if (crews.length === 0) {
    return (
      <p className="px-5 pt-10 text-center text-sm text-muted">
        집계할 크루가 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-2 px-5">
      {crews.map((c) => (
        <li key={c.crewId}>
          <Link
            href={`/master/${c.crewId}`}
            aria-label={`${c.name} 근무 상세 보기`}
            className="flex items-center gap-3 rounded-2xl border border-black/5 bg-surface px-4 py-3 transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.06] font-bold">
              {c.avatarInitial}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{c.name}</p>
              <p className="text-sm text-muted">
                근무 {minutesLabel(c.workMinutes)} · 연장{" "}
                {minutesLabel(c.overtimeMinutes)} · 휴일 {c.vacationDays}일
              </p>
            </div>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
