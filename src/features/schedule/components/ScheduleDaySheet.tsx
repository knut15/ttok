"use client";

// 날짜 탭 → 스케쥴 편집 시트(T19, 요구사항 3-A). 근무자별 시간/휴무 배정.
// canWrite=false(일반 멤버) → 읽기전용(배정 현황만). master/매니저 → 추가·수정·삭제.
// 부모가 key={date} 로 날짜별 리마운트 → drafts 는 useState 초기화로 동기화(effct setState 회피).
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Crew, FixedShift, ScheduleEntry } from "@/types";
import { formatLongDate } from "@/lib/date";
import { getOperatingHours, getWeekdayIndex } from "@/lib/schedule";
import type { SaveScheduleInput } from "@/features/schedule/hooks/useSchedule";

interface Draft {
  start: string;
  end: string;
  off: boolean;
}

type ChipKind = "고정" | "시간변경" | "대타" | "승인대기";
const CHIP_CLS: Record<ChipKind, string> = {
  고정: "bg-neutral-200 text-neutral-600",
  시간변경: "bg-statusblue/15 text-statusblue",
  대타: "bg-emerald-100 text-emerald-700",
  승인대기: "bg-amber-100 text-amber-700",
};

/**
 * 근무자 이름 옆 변경 칩 계산.
 * - 고정 자동적용(source fixed) → [고정]
 * - 대타(고정 없는데 근무 투입) → [대타]
 * - 고정 보유 + 변동저장(시간 다름) → [고정, 시간변경] / 시간 동일 → [고정]
 */
function chipsFor(e: ScheduleEntry | undefined, fixed: FixedShift | undefined): ChipKind[] {
  if (!e) return [];
  if (e.source === "fixed") return ["고정"];
  if (e.substitute) return e.approval === "대기" ? ["대타", "승인대기"] : ["대타"];
  if (fixed) {
    const changed = !e.off && (e.startTime !== fixed.startTime || e.endTime !== fixed.endTime);
    return changed ? ["고정", "시간변경"] : ["고정"];
  }
  return [];
}

function Chips({ kinds }: { kinds: ChipKind[] }) {
  if (kinds.length === 0) return null;
  return (
    <>
      {kinds.map((k) => (
        <span key={k} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CHIP_CLS[k]}`}>
          {k}
        </span>
      ))}
    </>
  );
}

export function ScheduleDaySheet({
  date,
  entries,
  crews,
  fixedShifts,
  canWrite,
  onClose,
  onSave,
  onRemove,
}: {
  date: string;
  entries: ScheduleEntry[];
  crews: Crew[];
  fixedShifts: FixedShift[];
  canWrite: boolean;
  onClose: () => void;
  onSave: (input: SaveScheduleInput) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
}) {
  const crewList = crews.filter((c) => c.role === "crew");
  const byCrew = new Map(entries.map((e) => [e.crewId, e]));
  // 이 날짜 요일에 적용되는 고정근무 맵(crewId → FixedShift) — 칩 계산용.
  const weekday = getWeekdayIndex(date);
  const fixedMap = new Map(
    fixedShifts.filter((f) => f.weekdays.includes(weekday)).map((f) => [f.crewId, f]),
  );
  // 근무 상태: 근무 / 비번(미배정) / 휴무(off). 비근무자는 흐리게, 정렬은 근무→비번→휴무.
  const STATE_ORDER = { 근무: 0, 비번: 1, 휴무: 2 } as const;
  type CrewState = keyof typeof STATE_ORDER;
  const stateOf = (e: ScheduleEntry | undefined): CrewState =>
    !e ? "비번" : e.off ? "휴무" : "근무";
  // 매니저 최상단 → 근무상태(근무→비번→휴무) → id 순.
  const sortedCrew = [...crewList].sort(
    (a, b) =>
      (a.isManager ? 0 : 1) - (b.isManager ? 0 : 1) ||
      STATE_ORDER[stateOf(byCrew.get(a.id))] - STATE_ORDER[stateOf(byCrew.get(b.id))] ||
      a.id.localeCompare(b.id),
  );
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

  // 읽기전용(일반 멤버): 전체 명단. 비근무자(비번/휴무)는 opacity 60%, 근무→비번→휴무 순.
  if (!canWrite) {
    return (
      <BottomSheet open onClose={onClose} title={title}>
        {sortedCrew.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">멤버가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {sortedCrew.map((c) => {
              const e = byCrew.get(c.id);
              const st = stateOf(e);
              const working = st === "근무";
              return (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 ${working ? "" : "opacity-60"}`}
                >
                  <span className="relative grid h-8 w-8 place-items-center rounded-full bg-foreground/[0.06] text-sm font-bold">
                    {c.avatarInitial}
                    {working ? (
                      <span
                        aria-label="근무"
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-statusgreen ring-2 ring-surface"
                      />
                    ) : null}
                  </span>
                  <span className="flex flex-1 flex-wrap items-center gap-1.5 font-semibold">
                    {c.name}
                    {c.isManager ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        멤버(매니저)
                      </span>
                    ) : null}
                    <Chips kinds={chipsFor(e, fixedMap.get(c.id))} />
                  </span>
                  <span className="text-sm text-muted">
                    {working ? `${e!.startTime}–${e!.endTime}` : st}
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
        {sortedCrew.map((c) => {
          const d = drafts[c.id] ?? DEFAULT_DRAFT;
          const existing = byCrew.get(c.id);
          const isManual = existing != null && existing.source !== "fixed";
          const st = stateOf(existing); // 현재 저장 상태(근무/비번/휴무)
          const working = st === "근무";
          return (
            <li key={c.id} className="rounded-xl border border-foreground/5 px-3 py-2.5">
              {/* 비근무자(비번/휴무)는 이름 영역을 흐리게 — 컨트롤은 정상 */}
              <div className={`flex items-center gap-2 ${working ? "" : "opacity-60"}`}>
                <span className="relative grid h-8 w-8 place-items-center rounded-full bg-foreground/[0.06] text-sm font-bold">
                  {c.avatarInitial}
                  {working ? (
                    <span
                      aria-label="근무"
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-statusgreen ring-2 ring-surface"
                    />
                  ) : null}
                </span>
                <span className="flex flex-1 flex-wrap items-center gap-1.5 font-semibold">
                  {c.name}
                  {c.isManager ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      멤버(매니저)
                    </span>
                  ) : null}
                  {working ? (
                    <Chips kinds={chipsFor(existing, fixedMap.get(c.id))} />
                  ) : (
                    <span className="rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                      {st}
                    </span>
                  )}
                </span>
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
                  className="w-0 min-w-0 flex-1 rounded-lg border border-foreground/10 px-2 py-1 text-sm"
                />
                <span className="text-muted">–</span>
                <input
                  type="time"
                  value={d.end}
                  disabled={d.off}
                  onChange={(e) => setDraft(c.id, { end: e.target.value })}
                  className="w-0 min-w-0 flex-1 rounded-lg border border-foreground/10 px-2 py-1 text-sm"
                />
              </div>
              <div className="mt-2 flex items-center justify-end gap-2">
                {isManual ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(existing!.id)}
                    aria-label={`${c.name} 배정 삭제`}
                    className="rounded-full bg-foreground/[0.06] px-4 py-1.5 text-xs font-semibold text-muted disabled:opacity-50"
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
                  {isManual ? "저장" : existing?.source === "fixed" ? "변동 저장" : "추가"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
