"use client";

// REWORK v2 / P1-2 / AC-11: 마스터 멤버 드릴다운 상세.
// MasterView 와 동일한 mount-gate 마스터 가드(role 진실원=localStorage → client 가드).
// useMonthAttendance(month, crewId) 로 대상 멤버의 월간 근무/휴일을 읽기 전용 표시.
// 마스터는 enforceReadScope 상 ?crewId= requested 허용(scope.ts) → 헤더(master)+쿼리(대상)로 fetch.
// 멤버가 이 경로 접근 시 가드(router.replace("/")). 빈 멤버 graceful.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MonthBar } from "@/components/MonthBar";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { useMonthAttendance } from "@/features/attendance/hooks/useAttendance";
import { useMonthPay } from "@/features/pay/hooks/usePay";

// perf: chart.js 레이더를 지연 로드(ssr:false) — 크루는 다운로드 안 함, 상세 진입 시만.
const StabilityRadar = dynamic(
  () => import("@/features/pay/components/StabilityRadar").then((m) => m.StabilityRadar),
  { ssr: false, loading: () => <div className="h-[420px] rounded-2xl border border-border bg-surface" /> },
);
import {
  longWorkLabel,
  statusTone,
} from "@/features/attendance/domain";
import { SEED_MONTH } from "@/lib/constants";
import type { Tone } from "@/lib/constants";
import { formatDotDate, weekdayKo, todayMonth } from "@/lib/date";

const emptySubscribe = () => () => {};

// 상태 톤 → 텍스트 색상 클래스(CalendarCell 색 토큰과 동일 팔레트).
const TONE_TEXT: Record<Tone, string> = {
  coral: "text-coral",
  green: "text-statusgreen",
  blue: "text-statusblue",
  gray: "text-muted",
  neutral: "text-foreground",
};

export function MasterCrewDetail({
  crewId,
  initialMonth,
}: {
  crewId: string;
  /** 집계뷰에서 전달된 선택 월(?month=). 없으면 현재월 default. */
  initialMonth?: string;
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  const { user } = useCurrentUser();
  // 전달된 월 우선, 없으면 mount 후 현재월(SEED_MONTH 는 mount 전 하이드레이션 안전용).
  const [picked, setPicked] = useState<string | null>(initialMonth ?? null);
  const month = picked ?? (mounted ? todayMonth() : SEED_MONTH);
  // 마스터일 때만 대상 멤버 fetch. 멤버(가드 진행 중)는 빈 인자로 호출 안 함.
  const { records, loading } = useMonthAttendance(month, crewId);
  // 안정성 레이더용 대상 멤버 급여 stats(마스터 스코프 ?crewId=). 마스터 전용 페이지이므로 노출 허용.
  const { data: pay } = useMonthPay(month, crewId);
  const stability = pay?.stats.stability;

  // 가드: mount 후(role 확정) 멤버면 홈으로. mount 전엔 리다이렉트 금지.
  useEffect(() => {
    if (mounted && user.role !== "master") {
      router.replace("/");
    }
  }, [mounted, user.role, router]);

  if (!mounted || user.role !== "master") {
    return (
      <div className="px-5 pt-10 text-center text-sm text-muted">
        불러오는 중…
      </div>
    );
  }

  // 날짜 오름차순 정렬(읽기 전용 일자 목록).
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="pb-24">
      <MonthBar month={month} onChange={setPicked} />
      <div className="flex items-center justify-between px-5 pb-4">
        <p className="text-sm text-muted">멤버 근무·휴일 상세 (읽기)</p>
        <Link
          href={`/pay/statement?crewId=${crewId}&month=${month}`}
          className="rounded-lg bg-coral px-3 py-1.5 text-xs font-semibold text-white"
        >
          급여명세서 작성
        </Link>
      </div>
      {/* 안정성 레이더(마스터·매니저 전용 인사이트). 급여 stats 있을 때만 노출. */}
      {stability && stability.length > 0 ? (
        <div className="px-5 pb-4">
          <StabilityRadar axes={stability} />
        </div>
      ) : null}
      {loading ? (
        <p className="px-5 pt-10 text-center text-sm text-muted">
          불러오는 중…
        </p>
      ) : sorted.length === 0 ? (
        <p className="px-5 pt-10 text-center text-sm text-muted">
          이 달 근무 기록이 없습니다.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {sorted.map((r) => (
            <li
              key={r.date}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3"
            >
              <div>
                <p className="font-semibold">
                  {formatDotDate(r.date)} ({weekdayKo(r.date)})
                </p>
                <p className="text-sm text-muted">
                  {r.clockIn && r.clockOut
                    ? `${r.clockIn} ~ ${r.clockOut}`
                    : "기록 없음"}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${TONE_TEXT[statusTone(r.status)]}`}
                >
                  {r.status}
                </p>
                {r.status !== "휴가" && (
                  <p className="text-sm text-muted">
                    {longWorkLabel(r.workMinutes)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
