"use client";

// 크루별 고정 근무 등록 시트(canWrite). 근무 요일을 일~토에서 직접 선택 + 시프트 시간 지정.
// 스케쥴표는 해당 요일에 명시 배정이 없으면 이 고정값을 자동 적용 → 변동만 기록.
// 부모가 key 로 마운트해 useState 초기화로 drafts 동기화(effect setState 회피).
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Crew, FixedShift } from "@/types";
import type { SaveFixedInput } from "@/features/schedule/hooks/useSchedule";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]; // index 0~6

interface Draft {
  weekdays: number[];
  start: string;
  end: string;
}

export function ScheduleFixedSheet({
  crews,
  fixedShifts,
  busy,
  onClose,
  onSave,
  onRemove,
}: {
  crews: Crew[];
  fixedShifts: FixedShift[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: SaveFixedInput) => Promise<boolean>;
  onRemove: (crewId: string) => Promise<boolean>;
}) {
  const crewList = crews.filter((c) => c.role === "crew");
  const byCrew = new Map(fixedShifts.map((f) => [f.crewId, f]));

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const c of crewList) {
      const f = byCrew.get(c.id);
      init[c.id] = f
        ? { weekdays: [...f.weekdays], start: f.startTime, end: f.endTime }
        : { weekdays: [], start: "09:00", end: "18:00" };
    }
    return init;
  });

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const toggleDay = (id: string, w: number) =>
    setDrafts((d) => {
      const cur = d[id];
      const has = cur.weekdays.includes(w);
      const weekdays = has
        ? cur.weekdays.filter((x) => x !== w)
        : [...cur.weekdays, w].sort((a, b) => a - b);
      return { ...d, [id]: { ...cur, weekdays } };
    });

  return (
    <BottomSheet open onClose={onClose} title="고정 근무 등록">
      <p className="pb-3 text-xs text-muted">
        크루별 근무 요일을 직접 선택하세요. 선택한 요일에 같은 시프트가 자동 적용되고, 스케쥴표엔 변동만 기록합니다.
      </p>
      <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
        {crewList.map((c) => {
          const d = drafts[c.id];
          const set = byCrew.has(c.id);
          const canSave = d.weekdays.length > 0;
          return (
            <li key={c.id} className="rounded-xl border border-black/5 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-sm font-bold">
                  {c.avatarInitial}
                </span>
                <span className="flex-1 font-semibold">{c.name}</span>
                {set ? (
                  <span className="rounded bg-coral/15 px-1.5 py-0.5 text-[10px] font-semibold text-coral">
                    등록됨
                  </span>
                ) : null}
              </div>
              {/* 요일 선택(일~토) — 선택한 요일만 컬러 */}
              <div className="mt-2 flex gap-1">
                {WEEKDAY_LABELS.map((label, w) => {
                  const on = d.weekdays.includes(w);
                  const weekendText = w === 0 ? "text-coral" : w === 6 ? "text-statusblue" : "";
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => toggleDay(c.id, w)}
                      aria-pressed={on}
                      className={`grid h-8 flex-1 place-items-center rounded-lg text-xs font-bold transition ${
                        on
                          ? "bg-coral text-white"
                          : `bg-black/[0.04] ${weekendText || "text-muted"}`
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  value={d.start}
                  onChange={(e) => setDraft(c.id, { start: e.target.value })}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm"
                />
                <span className="text-muted">–</span>
                <input
                  type="time"
                  value={d.end}
                  onChange={(e) => setDraft(c.id, { end: e.target.value })}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={busy || !canSave}
                  onClick={() => onSave({ crewId: c.id, weekdays: d.weekdays, startTime: d.start, endTime: d.end })}
                  className="shrink-0 rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  저장
                </button>
                {set ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemove(c.id)}
                    className="shrink-0 rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-50"
                  >
                    해제
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
