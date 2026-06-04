"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";
import { useMasterPendingCount } from "@/features/accounts/hooks/useMasterPendingCount";

// 하단 고정 바텀탭(AC-19b, AC-20). T8-5: role 별 분기.
// 멤버 = 기존 4탭. 마스터 = 집계(/master) 진입 중심 탭.
interface Tab {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

// 멤버 기본 4탭(회귀: 기존 구성 불변 — role 미확정 시에도 이 셋이 SSR/첫CSR 기본).
const CREW_TABS: Tab[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/attendance", label: "출퇴근", icon: "clock" },
  { href: "/schedule", label: "스케쥴", icon: "calendar" },
  { href: "/pay", label: "급여", icon: "won" },
  { href: "/mypage", label: "마이페이지", icon: "user" },
];

// 마스터 탭: 집계 진입(/master) 중심 + 스케쥴 + 마이페이지. 본인 출퇴근/급여 기록 없음(E-4) → 미노출.
const MASTER_TABS: Tab[] = [
  { href: "/master", label: "집계", icon: "won" },
  { href: "/schedule", label: "스케쥴", icon: "calendar" },
  { href: "/mypage", label: "마이페이지", icon: "user" },
];

// 마운트 여부 구독(하이드레이션 안전). 서버/첫CSR false → 기본 멤버 4탭으로 1차 렌더.
const emptySubscribe = () => () => {};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name, active }: { name: string; active: boolean }) {
  const cls = active ? "text-coral" : "text-muted";
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: cls,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l3 2M9 3h6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </svg>
      );
    case "won":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 9l2 6 3-6 3 6 2-6M6 12h12" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  // mount 전(localStorage 역할 복원 전)은 항상 멤버 4탭 → SSR/첫CSR 마크업 동일(mismatch 0).
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const tabs = mounted && user.role === "master" ? MASTER_TABS : CREW_TABS;
  // 마스터: 대기 수정요청(멤버 근태변경 승인) 알림 배지 — 집계 탭에 표시.
  const pending = useMasterPendingCount();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-foreground/5 bg-surface print:hidden">
      <ul className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          // 집계 탭에 대기 승인 알림 배지(마스터 전용, count>0).
          const badge = tab.href === "/master" && pending > 0 ? pending : null;
          const content = (
            <span className="relative flex flex-col items-center gap-1 py-1.5">
              <span className="relative">
                <Icon name={tab.icon} active={active} />
                {badge !== null ? (
                  <span
                    aria-label={`새 승인 요청 ${badge}건`}
                    className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] font-bold leading-none text-white"
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </span>
              <span
                className={`text-[11px] ${active ? "font-semibold text-coral" : "text-muted"}`}
              >
                {tab.label}
              </span>
            </span>
          );
          return (
            <li key={tab.href} className="flex-1 text-center">
              {tab.disabled ? (
                <button
                  type="button"
                  disabled
                  aria-disabled
                  className="w-full cursor-not-allowed opacity-50"
                >
                  {content}
                </button>
              ) : (
                <Link href={tab.href} className="block w-full">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
