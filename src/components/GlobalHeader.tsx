"use client";

// 전체 공통 헤더(layout 고정). 왼쪽=이전(뒤로가기), 가운데=화면 타이틀, 오른쪽=알림+로그인 계정.
// 타이틀/뒤로가기는 pathname 기반(SSR 일치). 로그인 계정 칩만 mount 후 표시(하이드레이션 안전).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { NotificationBell } from "@/components/NotificationBell";

const TITLES: Record<string, string> = {
  "/": "Crewmon",
  "/attendance": "출퇴근",
  "/schedule": "스케줄",
  "/pay": "급여",
  "/mypage": "마이페이지",
  "/mypage/profile": "프로필 수정",
  "/master": "대시보드",
};
const TOP_LEVEL = new Set(["/", "/attendance", "/schedule", "/pay", "/mypage", "/master"]);

function titleFor(path: string): string {
  if (TITLES[path]) return TITLES[path];
  if (path.startsWith("/attendance/")) return "근무 상세";
  if (path.startsWith("/pay/")) return "급여 상세";
  if (path.startsWith("/master/")) return "멤버 상세";
  return "Crewmon";
}

// 일부 상세 화면은 뒤로가기 시 히스토리(back) 대신 고정 부모로 이동.
// 근무 상세는 항상 출퇴근 달력에서만 진입 → /attendance 로 고정(요구).
function backTargetFor(path: string): string | null {
  if (path.startsWith("/attendance/")) return "/attendance";
  return null;
}

const emptySubscribe = () => () => {};

export function GlobalHeader() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user } = useCurrentUser();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const showBack = !TOP_LEVEL.has(pathname);
  const title = titleFor(pathname);
  const backTarget = backTargetFor(pathname);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-3 print:hidden">
      <div className="flex min-w-[44px] justify-start">
        {showBack ? (
          <button
            type="button"
            aria-label="이전"
            onClick={() => (backTarget ? router.push(backTarget) : router.back())}
            className="grid h-8 w-8 place-items-center rounded-full text-2xl leading-none text-foreground hover:bg-foreground/5"
          >
            ‹
          </button>
        ) : null}
      </div>
      <h1 className="flex-1 truncate text-center text-base font-bold text-foreground">
        {title}
      </h1>
      <div className="flex min-w-[44px] items-center justify-end gap-1.5">
        <NotificationBell />
        {mounted ? (
          <Link
            href="/mypage"
            aria-label={`로그인: ${user.name}`}
            className="grid h-8 w-8 place-items-center rounded-full bg-coral text-xs font-bold text-white"
          >
            {user.avatarInitial}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
