"use client";

// 멤버별 고정 근무 등록 시트(canWrite). 멤버당 (요일셋+시간) 블록을 여러 개 추가/편집/삭제.
// 예) 월~목 08:00~15:00 + 일 10:00~14:00(시간 다름). 한 멤버의 요일은 블록 간 겹치지 않음.
// 부모가 key 로 마운트해 useState 초기화(effect setState 회피).
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Crew, FixedShift } from "@/types";
import type { SaveFixedInput, UpdateFixedInput } from "@/features/schedule/hooks/useSchedule";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"]; // index 0~6

interface Draft {
  weekdays: number[];
  start: string;
  end: string;
}
const NEW_DRAFT: Draft = { weekdays: [], start: "09:00", end: "18:00" };

function weekdaysLabel(weekdays: number[]): string {
  return weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((w) => WEEKDAY_LABELS[w])
    .join("·");
}

/** 요일 선택 토글 줄(공용). disabled 집합의 요일은 비활성. */
function DayToggles({
  selected,
  disabled,
  onToggle,
}: {
  selected: number[];
  disabled: Set<number>;
  onToggle: (w: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {WEEKDAY_LABELS.map((label, w) => {
        const on = selected.includes(w);
        const dis = disabled.has(w);
        const weekendText = w === 0 ? "text-coral" : w === 6 ? "text-statusblue" : "";
        return (
          <button
            key={w}
            type="button"
            disabled={dis}
            onClick={() => onToggle(w)}
            aria-pressed={on}
            className={`grid h-8 flex-1 place-items-center rounded-lg text-xs font-bold transition ${
              on
                ? "bg-coral text-white"
                : dis
                  ? "bg-foreground/[0.03] text-foreground/20"
                  : `bg-foreground/[0.04] ${weekendText || "text-muted"}`
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ScheduleFixedSheet({
  crews,
  fixedShifts,
  busy,
  onClose,
  onSave,
  onUpdate,
  onRemove,
}: {
  crews: Crew[];
  fixedShifts: FixedShift[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: SaveFixedInput) => Promise<boolean>;
  onUpdate: (input: UpdateFixedInput) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  // 매니저 최상단 정렬.
  const crewList = crews
    .filter((c) => c.role === "crew")
    .sort((a, b) => (a.isManager ? 0 : 1) - (b.isManager ? 0 : 1) || a.id.localeCompare(b.id));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const c of crewList) init[c.id] = { ...NEW_DRAFT };
    return init;
  });
  // 편집 중인 블록.
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(NEW_DRAFT);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const toggleInList = (list: number[], w: number): number[] =>
    list.includes(w) ? list.filter((x) => x !== w) : [...list, w].sort((a, b) => a - b);

  async function addBlock(crewId: string) {
    const d = drafts[crewId];
    const ok = await onSave({ crewId, weekdays: d.weekdays, startTime: d.start, endTime: d.end });
    if (ok) setDraft(crewId, { weekdays: [] });
  }

  function beginEdit(b: FixedShift) {
    setEditId(b.id);
    setEditDraft({ weekdays: [...b.weekdays], start: b.startTime, end: b.endTime });
  }
  async function saveEdit() {
    if (!editId) return;
    const ok = await onUpdate({
      id: editId,
      weekdays: editDraft.weekdays,
      startTime: editDraft.start,
      endTime: editDraft.end,
    });
    if (ok) setEditId(null);
  }

  return (
    <BottomSheet open onClose={onClose} title="고정 근무 등록">
      <p className="pb-3 text-xs text-muted">
        멤버별 근무 요일·시간을 추가하세요. 요일별로 시간이 다르면 블록을 나눠 등록할 수 있습니다.
      </p>
      <ul className="max-h-[60vh] space-y-3 overflow-y-auto">
        {crewList.map((c) => {
          const blocks = fixedShifts.filter((f) => f.crewId === c.id);
          const used = new Set(blocks.flatMap((b) => b.weekdays));
          const d = drafts[c.id];
          return (
            <li key={c.id} className="rounded-xl border border-foreground/5 px-3 py-2.5">
              <div className="flex items-center gap-2 pb-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-foreground/[0.06] text-sm font-bold">
                  {c.avatarInitial}
                </span>
                <span className="flex flex-1 items-center gap-1.5 font-semibold">
                  {c.name}
                  {c.isManager ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      멤버(매니저)
                    </span>
                  ) : null}
                </span>
              </div>

              {/* 등록된 블록 — 보기/편집 */}
              {blocks.length > 0 ? (
                <ul className="mb-2 space-y-1">
                  {blocks.map((b) =>
                    b.id === editId ? (
                      <li key={b.id} className="rounded-lg border border-coral/30 bg-coral/[0.04] px-2.5 py-2">
                        <DayToggles
                          selected={editDraft.weekdays}
                          // 같은 멤버의 다른 블록 요일은 비활성(자기 자신 제외).
                          disabled={new Set(blocks.filter((x) => x.id !== b.id).flatMap((x) => x.weekdays))}
                          onToggle={(w) => setEditDraft((s) => ({ ...s, weekdays: toggleInList(s.weekdays, w) }))}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="time"
                            value={editDraft.start}
                            onChange={(e) => setEditDraft((s) => ({ ...s, start: e.target.value }))}
                            className="w-0 min-w-0 flex-1 rounded-lg border border-foreground/10 px-2 py-1 text-sm"
                          />
                          <span className="text-muted">–</span>
                          <input
                            type="time"
                            value={editDraft.end}
                            onChange={(e) => setEditDraft((s) => ({ ...s, end: e.target.value }))}
                            className="w-0 min-w-0 flex-1 rounded-lg border border-foreground/10 px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            disabled={busy || editDraft.weekdays.length === 0}
                            onClick={saveEdit}
                            className="shrink-0 rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            className="shrink-0 rounded-full bg-foreground/[0.06] px-3 py-1.5 text-xs font-semibold text-muted"
                          >
                            취소
                          </button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={b.id}
                        className="flex items-center gap-2 rounded-lg bg-coral/[0.06] px-2.5 py-1.5 text-sm"
                      >
                        <span className="font-semibold text-coral">{weekdaysLabel(b.weekdays)}</span>
                        <span className="text-muted">{b.startTime}–{b.endTime}</span>
                        <span className="flex-1" />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => beginEdit(b)}
                          className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-semibold text-foreground disabled:opacity-50"
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onRemove(b.id)}
                          aria-label={`${c.name} ${weekdaysLabel(b.weekdays)} 블록 삭제`}
                          className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-semibold text-muted disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              ) : null}

              {/* 새 블록 추가 */}
              <DayToggles
                selected={d.weekdays}
                disabled={used}
                onToggle={(w) => setDraft(c.id, { weekdays: toggleInList(d.weekdays, w) })}
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  value={d.start}
                  onChange={(e) => setDraft(c.id, { start: e.target.value })}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-foreground/10 px-2 py-1 text-sm"
                />
                <span className="text-muted">–</span>
                <input
                  type="time"
                  value={d.end}
                  onChange={(e) => setDraft(c.id, { end: e.target.value })}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-foreground/10 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={busy || d.weekdays.length === 0}
                  onClick={() => addBlock(c.id)}
                  className="shrink-0 rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  추가
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
