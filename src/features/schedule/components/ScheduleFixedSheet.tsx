"use client";

// 크루별 고정 근무 등록 시트(canWrite). 평일/주말 요일유형별 기본 시프트를 운영시간 내에서 지정.
// 스케쥴표는 명시 배정이 없으면 이 고정값을 자동 적용 → 변동만 기록.
// 부모가 key 로 마운트해 useState 초기화로 drafts 동기화(effect setState 회피).
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Crew, DayType, FixedShift } from "@/types";
import { getOperatingHoursByType } from "@/lib/schedule";
import type { SaveFixedInput } from "@/features/schedule/hooks/useSchedule";

const DAY_TYPES: { key: DayType; label: string }[] = [
  { key: "weekday", label: "평일" },
  { key: "weekend", label: "주말" },
];

interface Draft {
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
  onRemove: (crewId: string, dayType: DayType) => Promise<boolean>;
}) {
  const crewList = crews.filter((c) => c.role === "crew");
  const byKey = new Map(fixedShifts.map((f) => [`${f.crewId}|${f.dayType}`, f]));

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const c of crewList) {
      for (const { key } of DAY_TYPES) {
        const f = byKey.get(`${c.id}|${key}`);
        const op = getOperatingHoursByType(key);
        init[`${c.id}|${key}`] = f
          ? { start: f.startTime, end: f.endTime }
          : { start: op.open, end: op.close };
      }
    }
    return init;
  });

  const setDraft = (k: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [k]: { ...d[k], ...patch } }));

  return (
    <BottomSheet open onClose={onClose} title="고정 근무 등록">
      <p className="pb-3 text-xs text-muted">
        크루별 평일/주말 기본 시프트입니다. 스케쥴표는 변동만 기록하면 됩니다(운영시간 내 지정).
      </p>
      <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
        {crewList.map((c) => (
          <li key={c.id} className="rounded-xl border border-black/5 px-3 py-2.5">
            <div className="flex items-center gap-2 pb-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-sm font-bold">
                {c.avatarInitial}
              </span>
              <span className="font-semibold">{c.name}</span>
            </div>
            {DAY_TYPES.map(({ key, label }) => {
              const k = `${c.id}|${key}`;
              const d = drafts[k];
              const set = byKey.has(k);
              const op = getOperatingHoursByType(key);
              return (
                <div key={key} className="mt-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="w-8 font-semibold text-foreground">{label}</span>
                    <span>운영 {op.open}~{op.close}</span>
                    {set ? (
                      <span className="rounded bg-coral/15 px-1.5 py-0.5 font-semibold text-coral">
                        등록됨
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="time"
                      value={d.start}
                      onChange={(e) => setDraft(k, { start: e.target.value })}
                      className="w-0 min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm"
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      value={d.end}
                      onChange={(e) => setDraft(k, { end: e.target.value })}
                      className="w-0 min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSave({ crewId: c.id, dayType: key, startTime: d.start, endTime: d.end })}
                      className="shrink-0 rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      저장
                    </button>
                    {set ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRemove(c.id, key)}
                        className="shrink-0 rounded-full bg-black/[0.06] px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-50"
                      >
                        해제
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
