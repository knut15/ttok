"use client";

// 스케쥴 호스트 뷰(T19). 월 이동 + 캘린더 + 날짜 편집 시트.
// 읽기는 전원, 작성(추가/수정/삭제)은 canWrite(master/매니저)만 — 시트가 분기 처리.
import { useCallback, useState, useSyncExternalStore } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { useSchedule } from "@/features/schedule/hooks/useSchedule";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { ScheduleGrid } from "./ScheduleGrid";
import { ScheduleDaySheet } from "./ScheduleDaySheet";
import { ScheduleManagerSheet } from "./ScheduleManagerSheet";
import { ScheduleFixedSheet } from "./ScheduleFixedSheet";
import { SEED_MONTH } from "@/lib/constants";
import { formatMonthLabel, shiftMonth, todayMonth } from "@/lib/date";

type ViewMode = "calendar" | "grid";

// 마운트 여부 구독(AttendanceCalendarView 동일 패턴) — SSR/첫CSR 은 SEED_MONTH, 마운트 후 현재월.
const emptySubscribe = () => () => {};

export function ScheduleView() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { user } = useCurrentUser();
  const isMaster = mounted && user.role === "master"; // 매니저 지정은 마스터 전용
  // 기본 월: 마운트 후 현재월(6월). 사용자가 직접 고르면 그 값 유지.
  const [picked, setMonth] = useState<string | null>(null);
  const month = picked ?? (mounted ? todayMonth() : SEED_MONTH);
  const [view, setView] = useState<ViewMode>("calendar");
  const [selected, setSelected] = useState<string | null>(null);
  const [managerSheetOpen, setManagerSheetOpen] = useState(false);
  const [managerBusyId, setManagerBusyId] = useState<string | null>(null);
  const [fixedSheetOpen, setFixedSheetOpen] = useState(false);
  const [fixedBusy, setFixedBusy] = useState(false);
  const {
    entries,
    fixedShifts,
    canWrite,
    crews,
    loading,
    reload,
    save,
    remove,
    saveFixed,
    removeFixed,
  } = useSchedule(month);

  const saveFixedShift = useCallback(
    async (input: Parameters<typeof saveFixed>[0]) => {
      setFixedBusy(true);
      try {
        return await saveFixed(input);
      } finally {
        setFixedBusy(false);
      }
    },
    [saveFixed],
  );
  const removeFixedShift = useCallback(
    async (crewId: string, dayType: Parameters<typeof removeFixed>[1]) => {
      setFixedBusy(true);
      try {
        return await removeFixed(crewId, dayType);
      } finally {
        setFixedBusy(false);
      }
    },
    [removeFixed],
  );

  const dayEntries = selected ? entries.filter((e) => e.date === selected) : [];

  // 매니저 지정/해제(마스터 전용). PATCH 후 crews 재로드.
  const toggleManager = useCallback(
    async (crewId: string, on: boolean) => {
      setManagerBusyId(crewId);
      try {
        const res = await fetch(`/api/master/crews/${crewId}/manager`, {
          method: "PATCH",
          cache: "no-store",
          headers: { ...authHeaders(user), "Content-Type": "application/json" },
          body: JSON.stringify({ on }),
        });
        if (res.ok) reload();
      } finally {
        setManagerBusyId(null);
      }
    },
    [user, reload],
  );

  return (
    <div className="pb-24">
      <AppHeader
        title={
          <span className="flex items-center gap-3">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="grid h-8 w-8 place-items-center leading-none text-muted"
            >
              ‹
            </button>
            <MonthSelector label={formatMonthLabel(month)} />
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="grid h-8 w-8 place-items-center leading-none text-muted"
            >
              ›
            </button>
          </span>
        }
      />
      <div className="flex items-center justify-between px-5 pb-3">
        <p className="text-sm text-muted">
          근무 스케쥴{canWrite ? " · 탭하여 근무자 배정" : ""}
        </p>
        {/* 달력 / 표 보기 토글(요구사항 3: 둘 다). */}
        <div className="flex rounded-full bg-black/[0.06] p-0.5 text-xs font-semibold">
          {(["calendar", "grid"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setView(m)}
              aria-pressed={view === m}
              className={`rounded-full px-3 py-1 transition ${
                view === m ? "bg-surface text-foreground shadow-sm" : "text-muted"
              }`}
            >
              {m === "calendar" ? "달력" : "표"}
            </button>
          ))}
        </div>
      </div>
      {canWrite ? (
        <div className="flex items-center justify-end gap-2 px-5 pb-3">
          <button
            type="button"
            onClick={() => setFixedSheetOpen(true)}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold"
          >
            고정 근무
          </button>
          {isMaster ? (
            <button
              type="button"
              onClick={() => setManagerSheetOpen(true)}
              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold"
            >
              매니저 지정
            </button>
          ) : null}
        </div>
      ) : null}
      {view === "calendar" ? (
        <ScheduleCalendar
          month={month}
          entries={entries}
          crews={crews}
          loading={loading}
          onSelectDate={setSelected}
        />
      ) : (
        <ScheduleGrid
          month={month}
          entries={entries}
          crews={crews}
          loading={loading}
          onSelectDate={setSelected}
        />
      )}
      {selected ? (
        <ScheduleDaySheet
          key={selected}
          date={selected}
          entries={dayEntries}
          crews={crews}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onSave={save}
          onRemove={remove}
        />
      ) : null}
      {managerSheetOpen ? (
        <ScheduleManagerSheet
          crews={crews}
          busyId={managerBusyId}
          onClose={() => setManagerSheetOpen(false)}
          onToggle={toggleManager}
        />
      ) : null}
      {fixedSheetOpen ? (
        <ScheduleFixedSheet
          crews={crews}
          fixedShifts={fixedShifts}
          busy={fixedBusy}
          onClose={() => setFixedSheetOpen(false)}
          onSave={saveFixedShift}
          onRemove={removeFixedShift}
        />
      ) : null}
    </div>
  );
}
