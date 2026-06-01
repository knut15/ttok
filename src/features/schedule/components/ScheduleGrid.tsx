"use client";

// 월간 근무표 그리드(T20, 요구사항 3-B). 근무자(행)×일자(열) 매트릭스.
// 좁은 모바일 폭 → 일자 열은 가로 스크롤, 근무자명 열은 sticky. 셀 탭 → 날짜 편집 시트.
import { useMemo } from "react";
import { buildMonthGrid, weekdayKo } from "@/lib/date";
import type { Crew, ScheduleEntry } from "@/types";

export function ScheduleGrid({
  month,
  entries,
  crews,
  loading,
  onSelectDate,
}: {
  month: string;
  entries: ScheduleEntry[];
  crews: Crew[];
  loading: boolean;
  onSelectDate: (date: string) => void;
}) {
  // 매니저 최상단 정렬.
  const crewList = useMemo(
    () =>
      crews
        .filter((c) => c.role === "crew")
        .sort((a, b) => (a.isManager ? 0 : 1) - (b.isManager ? 0 : 1) || a.id.localeCompare(b.id)),
    [crews],
  );
  const dates = useMemo(
    () => buildMonthGrid(month).filter((d): d is string => d !== null),
    [month],
  );
  // (date|crewId) → entry 빠른 조회.
  const byKey = useMemo(() => {
    const m = new Map<string, ScheduleEntry>();
    for (const e of entries) m.set(`${e.date}|${e.crewId}`, e);
    return m;
  }, [entries]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>;
  }
  if (crewList.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">근무자가 없습니다.</p>;
  }

  const weekendColor = (d: string) => {
    const w = weekdayKo(d);
    return w === "일" ? "text-coral" : w === "토" ? "text-statusblue" : "text-muted";
  };

  return (
    <div className="overflow-x-auto px-4 pb-2">
      <table className="border-separate border-spacing-0 text-center">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 py-1 text-left text-xs font-semibold">
              근무자
            </th>
            {dates.map((d) => (
              <th key={d} className={`min-w-[34px] px-0.5 py-1 text-[10px] ${weekendColor(d)}`}>
                <div className="font-bold">{Number(d.slice(-2))}</div>
                <div>{weekdayKo(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crewList.map((c) => (
            <tr key={c.id}>
              <th className="sticky left-0 z-10 bg-surface px-2 py-3 text-left text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-black/[0.06] text-[9px] font-bold">
                    {c.avatarInitial}
                  </span>
                  <span className="whitespace-nowrap">{c.name}</span>
                </span>
              </th>
              {dates.map((d) => {
                const e = byKey.get(`${d}|${c.id}`);
                return (
                  <td key={d} className="min-w-[34px] border-b border-black/5 px-0.5 py-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectDate(d)}
                      aria-label={`${c.name} ${Number(d.slice(-2))}일 스케쥴`}
                      className={`flex h-12 w-full flex-col items-center justify-center rounded text-[9px] leading-tight ${
                        e && !e.off
                          ? "bg-coral/10 font-semibold text-coral"
                          : "text-muted opacity-60 hover:opacity-100" // 비근무(비번/휴무) 흐리게
                      }`}
                    >
                      {e ? (
                        e.off ? (
                          "휴무"
                        ) : (
                          <>
                            <span>{e.startTime}</span>
                            <span>{e.endTime}</span>
                          </>
                        )
                      ) : (
                        "비번"
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
