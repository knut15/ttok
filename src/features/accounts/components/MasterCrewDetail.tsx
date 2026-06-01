"use client";

// REWORK v2 / P1-2 / AC-11: 마스터 멤버 드릴다운 상세.
// MasterView 와 동일한 mount-gate 마스터 가드(role 진실원=localStorage → client 가드).
// useMonthAttendance(month, crewId) 로 대상 멤버의 월간 근무/휴일을 읽기 전용 표시.
// 마스터는 enforceReadScope 상 ?crewId= requested 허용(scope.ts) → 헤더(master)+쿼리(대상)로 fetch.
// 멤버가 이 경로 접근 시 가드(router.replace("/")). 빈 멤버 graceful.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { MonthSelector } from "@/components/MonthSelector";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { useMonthAttendance } from "@/features/attendance/hooks/useAttendance";
import {
  longWorkLabel,
  statusTone,
} from "@/features/attendance/domain";
import { SEED_MONTH } from "@/lib/constants";
import type { Tone } from "@/lib/constants";
import {
  formatDotDate,
  formatMonthLabel,
  shiftMonth,
  weekdayKo,
} from "@/lib/date";

const emptySubscribe = () => () => {};

// 상태 톤 → 텍스트 색상 클래스(CalendarCell 색 토큰과 동일 팔레트).
const TONE_TEXT: Record<Tone, string> = {
  coral: "text-coral",
  green: "text-statusgreen",
  blue: "text-statusblue",
  gray: "text-muted",
  neutral: "text-foreground",
};

export function MasterCrewDetail({ crewId }: { crewId: string }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  const { user } = useCurrentUser();
  const [month, setMonth] = useState(SEED_MONTH);
  // 마스터일 때만 대상 멤버 fetch. 멤버(가드 진행 중)는 빈 인자로 호출 안 함.
  const { records, loading } = useMonthAttendance(month, crewId);

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
        right={
          <Link href="/master" aria-label="집계로 돌아가기" className="text-muted">
            집계 ›
          </Link>
        }
      />
      <p className="px-5 pb-4 text-sm text-muted">멤버 근무·휴일 상세 (읽기)</p>
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
              className="flex items-center justify-between rounded-2xl border border-black/5 bg-surface px-4 py-3"
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
