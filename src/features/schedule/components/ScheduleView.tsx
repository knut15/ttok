"use client";

// 스케쥴 호스트 뷰(T19). 월 이동 + 캘린더 + 날짜 편집 시트.
// 읽기는 전원, 작성(추가/수정/삭제)은 canWrite(master/매니저)만 — 시트가 분기 처리.
import { useCallback, useState, useSyncExternalStore } from "react";
import { MonthBar } from "@/components/MonthBar";
import { StoreBar } from "@/components/StoreBar";
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
import { todayMonth } from "@/lib/date";

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
    updateFixed,
    removeFixed,
  } = useSchedule(month);

  // 일반 멤버는 본인만, master/매니저(canWrite)는 전체 멤버를 본다(요구사항).
  const myCrewId = user.crewId ?? user.id;
  const visibleCrews = canWrite ? crews : crews.filter((c) => c.id === myCrewId);

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
  const updateFixedShift = useCallback(
    async (input: Parameters<typeof updateFixed>[0]) => {
      setFixedBusy(true);
      try {
        return await updateFixed(input);
      } finally {
        setFixedBusy(false);
      }
    },
    [updateFixed],
  );
  const removeFixedShift = useCallback(
    async (id: string) => {
      setFixedBusy(true);
      try {
        return await removeFixed(id);
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
      <StoreBar
        right={
          /* 달력/표 보기 스위치 */
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>
              <span className={view === "calendar" ? "text-foreground" : "text-muted"}>
                달력
              </span>
              <span className="text-muted">/</span>
              <span className={view === "grid" ? "text-foreground" : "text-muted"}>표</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={view === "grid"}
              aria-label="달력/표 보기 전환"
              onClick={() => setView(view === "calendar" ? "grid" : "calendar")}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                view === "grid" ? "bg-coral" : "bg-foreground/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-all ${
                  view === "grid" ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        }
      />
      <MonthBar month={month} onChange={setMonth} />
      {canWrite ? (
        <div className="flex items-center justify-end gap-2 px-5 pb-3">
          <button
            type="button"
            onClick={() => setFixedSheetOpen(true)}
            className="rounded-full border border-foreground/10 px-3 py-1.5 text-xs font-semibold"
          >
            고정 근무
          </button>
          {isMaster ? (
            <button
              type="button"
              onClick={() => setManagerSheetOpen(true)}
              className="rounded-full border border-foreground/10 px-3 py-1.5 text-xs font-semibold"
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
          crews={visibleCrews}
          loading={loading}
          onSelectDate={setSelected}
        />
      ) : (
        <ScheduleGrid
          month={month}
          entries={entries}
          crews={visibleCrews}
          loading={loading}
          onSelectDate={setSelected}
        />
      )}
      {selected ? (
        <ScheduleDaySheet
          key={selected}
          date={selected}
          entries={dayEntries}
          crews={visibleCrews}
          fixedShifts={fixedShifts}
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
          onUpdate={updateFixedShift}
          onRemove={removeFixedShift}
        />
      ) : null}
    </div>
  );
}
