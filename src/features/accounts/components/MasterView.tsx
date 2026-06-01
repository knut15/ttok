"use client";

// /master 클라이언트 가드 + 집계뷰 조립(T8-5). architect §4.
// role 은 클라 컨텍스트(localStorage) 진실원 → SSR 가드 불가, client 가드.
// 하이드레이션 안전: mount 전(localStorage 복원 전)에는 섣부른 리다이렉트 금지(로딩 가드).
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { useMasterSummary } from "@/features/accounts/hooks/useMasterSummary";
import { useMasterRequests } from "@/features/accounts/hooks/useMasterRequests";
import { CrewSummaryList } from "./CrewSummaryList";
import { MasterRequestList } from "./MasterRequestList";
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
  const { crews, loading } = useMasterSummary(month);
  const {
    requests,
    loading: requestsLoading,
    approve,
  } = useMasterRequests();

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
      />
      <p className="px-5 pb-4 text-sm text-muted">전체 크루 근무 집계</p>
      {loading ? (
        <p className="px-5 pt-10 text-center text-sm text-muted">
          집계 불러오는 중…
        </p>
      ) : (
        <CrewSummaryList crews={crews} />
      )}

      {/* FR-2: 마스터 수정요청 컨펌 섹션(가드 하위). 전체 크루 요청 조회·수락. */}
      <section className="pt-8">
        <h2 className="px-5 pb-3 text-lg font-bold">수정요청 컨펌</h2>
        {requestsLoading ? (
          <p className="px-5 pt-2 text-center text-sm text-muted">
            수정요청 불러오는 중…
          </p>
        ) : (
          <MasterRequestList requests={requests} onApprove={approve} />
        )}
      </section>
    </div>
  );
}
