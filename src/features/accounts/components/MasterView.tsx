"use client";

// /master 클라이언트 가드 + 집계뷰 조립(T8-5). architect §4.
// role 은 클라 컨텍스트(localStorage) 진실원 → SSR 가드 불가, client 가드.
// 하이드레이션 안전: mount 전(localStorage 복원 전)에는 섣부른 리다이렉트 금지(로딩 가드).
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MonthBar } from "@/components/MonthBar";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";
import { useMasterSummary } from "@/features/accounts/hooks/useMasterSummary";
import { useMasterRequests } from "@/features/accounts/hooks/useMasterRequests";
import { useMasterSubstitutes } from "@/features/accounts/hooks/useMasterSubstitutes";
import { CrewSummaryList } from "./CrewSummaryList";
import { MasterRequestList } from "./MasterRequestList";

// perf: chart.js(~67KB gz)를 대시보드에서만 지연 로드 — 공유 번들에서 분리(ssr:false).
const CrewWorkChart = dynamic(
  () => import("./CrewWorkChart").then((m) => m.CrewWorkChart),
  { ssr: false, loading: () => <div className="mx-5 mb-4 h-[300px] rounded-2xl border border-border bg-surface" /> },
);
import { formatPayRowDate, todayMonth } from "@/lib/date";
import { SEED_MONTH } from "@/lib/constants";

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
  // 현재월 기준 default(다른 화면 동일 패턴). mount 전엔 SEED_MONTH(하이드레이션 안전), 후엔 todayMonth().
  // picked(사용자 월 선택)가 있으면 우선.
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? (mounted ? todayMonth() : SEED_MONTH);
  const { crews, loading, reload } = useMasterSummary(month);

  // perf/UX: 매니저 토글 낙관적 반영 — 탭 즉시 pill 반전(서버 왕복 동안 "멈춘 느낌" 제거),
  //   실패 시 롤백, 서버 재조회(crews 갱신) 시 override 초기화로 서버 truth 화해.
  const [managerOverride, setManagerOverride] = useState<Record<string, boolean>>({});
  const [managerBusyId, setManagerBusyId] = useState<string | null>(null);
  // 새 집계가 도착하면 낙관 override 폐기(서버 값이 진실).
  useEffect(() => {
    setManagerOverride({});
  }, [crews]);

  const toggleManager = useCallback(
    async (crewId: string, on: boolean) => {
      setManagerOverride((o) => ({ ...o, [crewId]: on })); // 즉시 반영
      setManagerBusyId(crewId);
      try {
        const res = await fetch(`/api/master/crews/${crewId}/manager`, {
          method: "PATCH",
          cache: "no-store",
          headers: { ...authHeaders(user), "Content-Type": "application/json" },
          body: JSON.stringify({ on }),
        });
        if (res.ok) {
          reload(); // 성공 → 재집계(도착 시 override 초기화)
        } else {
          setManagerOverride((o) => {
            const n = { ...o };
            delete n[crewId];
            return n;
          }); // 실패 롤백
        }
      } catch {
        setManagerOverride((o) => {
          const n = { ...o };
          delete n[crewId];
          return n;
        });
      } finally {
        setManagerBusyId(null);
      }
    },
    [user, reload],
  );
  // 낙관 override 를 입힌 표시용 목록.
  const crewsView = crews.map((c) =>
    c.crewId in managerOverride ? { ...c, isManager: managerOverride[c.crewId] } : c,
  );
  const {
    requests,
    loading: requestsLoading,
    approve,
  } = useMasterRequests();
  // 선택 월의 수정요청만 노출(date "YYYY-MM-DD" 가 month "YYYY-MM" 으로 시작). 월 변경 시 해당 월만.
  const monthRequests = requests.filter((r) => r.date.startsWith(month));
  // 대기(미승인) 수정요청 = 멤버 근태변경 승인 알림 건수(해당 월 기준).
  const pendingCount = monthRequests.filter((r) => r.status === "대기").length;
  // 대타 승인 대기.
  const {
    substitutes,
    loading: substitutesLoading,
    approve: approveSubstitute,
  } = useMasterSubstitutes();

  // 가드: mount 후(role 확정) 멤버면 홈으로. mount 전엔 리다이렉트 금지(role 미확정).
  useEffect(() => {
    if (mounted && user.role !== "master") {
      router.replace("/");
    }
  }, [mounted, user.role, router]);

  // role 미확정(mount 전) 또는 멤버(리다이렉트 진행 중) → 로딩 가드(빈 화면).
  if (!mounted || user.role !== "master") {
    return (
      <div className="px-5 pt-10 text-center text-sm text-muted">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="pb-24">
      <MonthBar month={month} onChange={setPicked} />
      <p className="px-5 pb-4 text-sm text-muted">전체 멤버 근무 현황</p>
      {loading ? (
        <p className="px-5 pt-10 text-center text-sm text-muted">
          불러오는 중…
        </p>
      ) : (
        <>
          <CrewWorkChart crews={crews} />
          <CrewSummaryList
            crews={crewsView}
            month={month}
            onToggleManager={toggleManager}
            busyCrewId={managerBusyId}
          />
        </>
      )}

      {/* FR-2: 마스터 수정요청 컨펌 섹션(가드 하위). 전체 멤버 요청 조회·수락. */}
      <section className="pt-8">
        <h2 className="flex items-center gap-2 px-5 pb-4 text-lg font-bold tracking-tight">
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
            멤버의 근태변경 승인 요청 {pendingCount}건이 대기 중입니다.
          </p>
        ) : null}
        {requestsLoading ? (
          <p className="px-5 pt-2 text-center text-sm text-muted">
            수정요청 불러오는 중…
          </p>
        ) : (
          <MasterRequestList requests={monthRequests} onApprove={approve} />
        )}
      </section>

      {/* 대타 승인: 매니저가 등록한 대타(고정 요일 아님) 근무를 마스터가 승인. */}
      <section className="pt-8">
        <h2 className="flex items-center gap-2 px-5 pb-4 text-lg font-bold tracking-tight">
          대타 승인
          {substitutes.length > 0 ? (
            <span
              aria-label={`대타 ${substitutes.length}건`}
              className="grid h-6 min-w-6 place-items-center rounded-full bg-statusgreen px-1.5 text-xs font-bold text-white"
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
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-greensoft text-sm font-bold text-statusgreen">
                  {s.crewName.slice(0, 1)}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">
                    {s.crewName}
                    <span className="ml-2 rounded bg-greensoft px-1.5 py-0.5 text-[10px] font-semibold text-statusgreen">
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
