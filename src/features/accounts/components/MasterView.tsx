"use client";

// /master 클라이언트 가드 + 집계뷰 조립(T8-5). architect §4.
// role 은 클라 컨텍스트(localStorage) 진실원 → SSR 가드 불가, client 가드.
// 하이드레이션 안전: mount 전(localStorage 복원 전)에는 섣부른 리다이렉트 금지(로딩 가드).
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { useMasterSummary } from "@/features/accounts/hooks/useMasterSummary";
import { useMasterRequests } from "@/features/accounts/hooks/useMasterRequests";
import { useMasterSubstitutes } from "@/features/accounts/hooks/useMasterSubstitutes";
import { CrewSummaryList } from "./CrewSummaryList";
import { CrewWorkChart } from "./CrewWorkChart";
import { MasterRequestList } from "./MasterRequestList";
import { NotificationBell } from "@/components/NotificationBell";
import { formatPayRowDate } from "@/lib/date";
import { SEED_MONTH } from "@/lib/constants";
import { formatMonthLabel, shiftMonth } from "@/lib/date";

// 마운트 여부 구독(AttendanceCalendarView 동일 패턴). 서버/첫CSR false →
// 마운트 후 localStorage 역할 복원이 끝난 시점에서만 가드 판정.
const emptySubscribe = () => () => {};

export function MasterView() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  const { user } = useCurrentUser();
  const [month, setMonth] = useState(SEED_MONTH);
  const { crews, loading, reload } = useMasterSummary(month);

  // 매니저 지정/해제(마스터 전용). PATCH 후 집계 재로드로 토글 상태 반영.
  const toggleManager = useCallback(
    async (crewId: string, on: boolean) => {
      const res = await fetch(`/api/master/crews/${crewId}/manager`, {
        method: "PATCH",
        cache: "no-store",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify({ on }),
      });
      if (res.ok) reload();
    },
    [user, reload],
  );
  const {
    requests,
    loading: requestsLoading,
    approve,
  } = useMasterRequests();
  // 대기(미승인) 수정요청 = 크루 근태변경 승인 알림 건수.
  const pendingCount = requests.filter((r) => r.status === "대기").length;
  // 대타 승인 대기.
  const {
    substitutes,
    loading: substitutesLoading,
    approve: approveSubstitute,
  } = useMasterSubstitutes();

  // 가드: mount 후(role 확정) 크루면 홈으로. mount 전엔 리다이렉트 금지(role 미확정).
  useEffect(() => {
    if (mounted && user.role !== "master") {
      router.replace("/");
    }
  }, [mounted, user.role, router]);

  // role 미확정(mount 전) 또는 크루(리다이렉트 진행 중) → 로딩 가드(빈 화면).
  if (!mounted || user.role !== "master") {
    return (
      <div className="px-5 pt-10 text-center text-sm text-muted">
        불러오는 중…
      </div>
    );
  }

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
        right={<NotificationBell />}
      />
      <p className="px-5 pb-4 text-sm text-muted">전체 크루 근무 집계</p>
      {loading ? (
        <p className="px-5 pt-10 text-center text-sm text-muted">
          집계 불러오는 중…
        </p>
      ) : (
        <>
          <CrewWorkChart crews={crews} />
          <CrewSummaryList crews={crews} onToggleManager={toggleManager} />
        </>
      )}

      {/* FR-2: 마스터 수정요청 컨펌 섹션(가드 하위). 전체 크루 요청 조회·수락. */}
      <section className="pt-8">
        <h2 className="flex items-center gap-2 px-5 pb-3 text-lg font-bold">
          수정요청 컨펌
          {pendingCount > 0 ? (
            <span
              aria-label={`대기 ${pendingCount}건`}
              className="grid h-6 min-w-6 place-items-center rounded-full bg-coral px-1.5 text-xs font-bold text-white"
            >
              {pendingCount}
            </span>
          ) : null}
        </h2>
        {pendingCount > 0 ? (
          <p className="mx-5 mb-3 rounded-xl bg-coral/10 px-3 py-2 text-sm font-medium text-coral">
            크루의 근태변경 승인 요청 {pendingCount}건이 대기 중입니다.
          </p>
        ) : null}
        {requestsLoading ? (
          <p className="px-5 pt-2 text-center text-sm text-muted">
            수정요청 불러오는 중…
          </p>
        ) : (
          <MasterRequestList requests={requests} onApprove={approve} />
        )}
      </section>

      {/* 대타 승인: 매니저가 등록한 대타(고정 요일 아님) 근무를 마스터가 승인. */}
      <section className="pt-8">
        <h2 className="flex items-center gap-2 px-5 pb-3 text-lg font-bold">
          대타 승인
          {substitutes.length > 0 ? (
            <span
              aria-label={`대타 ${substitutes.length}건`}
              className="grid h-6 min-w-6 place-items-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white"
            >
              {substitutes.length}
            </span>
          ) : null}
        </h2>
        {substitutesLoading ? (
          <p className="px-5 pt-2 text-center text-sm text-muted">대타 불러오는 중…</p>
        ) : substitutes.length === 0 ? (
          <p className="px-5 text-center text-sm text-muted">승인 대기 중인 대타가 없습니다.</p>
        ) : (
          <ul className="space-y-2 px-5">
            {substitutes.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-surface px-4 py-3"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                  {s.crewName.slice(0, 1)}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">
                    {s.crewName}
                    <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      대타
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    {formatPayRowDate(s.date)} · {s.startTime}–{s.endTime}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => approveSubstitute(s.id)}
                  className="rounded-full bg-coral px-4 py-1.5 text-sm font-semibold text-white"
                >
                  승인
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
