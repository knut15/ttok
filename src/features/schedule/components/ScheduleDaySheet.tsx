"use client";

// 날짜 탭 → 스케쥴 편집 시트(T19, 요구사항 3-A). 근무자별 시간/휴무 배정.
// canWrite=false(일반 크루) → 읽기전용(배정 현황만). master/매니저 → 추가·수정·삭제.
// 부모가 key={date} 로 날짜별 리마운트 → drafts 는 useState 초기화로 동기화(effct setState 회피).
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Crew, ScheduleEntry } from "@/types";
import { formatLongDate } from "@/lib/date";
import { getOperatingHours } from "@/lib/schedule";
import type { SaveScheduleInput } from "@/features/schedule/hooks/useSchedule";

interface Draft {
  start: string;
  end: string;
  off: boolean;
}

export function ScheduleDaySheet({
  date,
  entries,
  crews,
  canWrite,
  onClose,
  onSave,
  onRemove,
}: {
  date: string;
  entries: ScheduleEntry[];
  crews: Crew[];
  canWrite: boolean;
  onClose: () => void;
  onSave: (input: SaveScheduleInput) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const crewList = crews.filter((c) => c.role === "crew");
  const byCrew = new Map(entries.map((e) => [e.crewId, e]));
  // 운영시간 — 신규 배정 기본 시프트로 사용(근무시간은 이 범위 내에서 개별 등록).
  const op = getOperatingHours(date);
  const DEFAULT_DRAFT: Draft = { start: op.open, end: op.close, off: false };
  const [busy, setBusy] = useState(false);
  // 최초 배정 상태로 초기화(key={date} 리마운트 전제). 이후 입력은 이 state 만 변경.
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const c of crews) {
      if (c.role !== "crew") continue;
      const e = entries.find((x) => x.crewId === c.id);
      init[c.id] = e
        ? { start: e.startTime, end: e.endTime, off: e.off === true }
        : { start: op.open, end: op.close, off: false };
    }
    return init;
  });

  const setDraft = (crewId: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [crewId]: { ...(d[crewId] ?? DEFAULT_DRAFT), ...patch } }));

  async function save(crewId: string) {
    const d = drafts[crewId] ?? DEFAULT_DRAFT;
    setBusy(true);
    try {
      await onSave({ date, crewId, startTime: d.start, endTime: d.end, off: d.off });
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await onRemove(id);
    } finally {
      setBusy(false);
    }
  }

  const title = formatLongDate(date); // 요일 포함

  // 읽기전용(일반 크루): 배정된 근무자만 시간과 함께 표시.
  if (!canWrite) {
    const assigned = crewList.filter((c) => byCrew.has(c.id));
    return (
      <BottomSheet open onClose={onClose} title={title}>
        {assigned.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">등록된 스케쥴이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {assigned.map((c) => {
              const e = byCrew.get(c.id)!;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-xl bg-black/[0.03] px-3 py-2.5"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-sm font-bold">
                    {c.avatarInitial}
                  </span>
                  <span className="flex-1 font-semibold">{c.name}</span>
                  <span className="text-sm text-muted">
                    {e.off ? "휴무" : `${e.startTime}–${e.endTime}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title={title}>
      <p className="pb-3 text-xs text-muted">
        운영시간 {op.open}–{op.close} · 근무자별 근무시간을 지정하세요(휴무는 시간 없이 저장).
      </p>
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
        {crewList.map((c) => {
          const d = drafts[c.id] ?? DEFAULT_DRAFT;
          const existing = byCrew.get(c.id);
          return (
            <li key={c.id} className="rounded-xl border border-black/5 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-sm font-bold">
                  {c.avatarInitial}
                </span>
                <span className="flex-1 font-semibold">{c.name}</span>
                <label className="flex items-center gap-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={d.off}
                    onChange={(e) => setDraft(c.id, { off: e.target.checked })}
                  />
                  휴무
                </label>
              </div>
              <div className={`mt-2 flex items-center gap-2 ${d.off ? "opacity-40" : ""}`}>
                <input
                  type="time"
                  value={d.start}
                  disabled={d.off}
                  onChange={(e) => setDraft(c.id, { start: e.target.value })}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm"
                />
                <span className="text-muted">–</span>
                <input
                  type="time"
                  value={d.end}
                  disabled={d.off}
                  onChange={(e) => setDraft(c.id, { end: e.target.value })}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm"
                />
              </div>
              <div className="mt-2 flex items-center justify-end gap-2">
                {existing ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(existing.id)}
                    aria-label={`${c.name} 배정 삭제`}
                    className="rounded-full bg-black/[0.06] px-4 py-1.5 text-xs font-semibold text-muted disabled:opacity-50"
                  >
                    삭제
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(c.id)}
                  className="rounded-full bg-coral px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {existing ? "저장" : "추가"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
