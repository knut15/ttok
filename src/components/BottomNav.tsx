"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 하단 고정 바텀탭 4개(AC-19b, AC-20). 마이페이지는 비활성 플레이스홀더.
interface Tab {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/attendance", label: "출퇴근", icon: "clock" },
  { href: "/pay", label: "급여", icon: "won" },
  { href: "/mypage", label: "마이페이지", icon: "user", disabled: true },
];

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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-black/5 bg-surface">
      <ul className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const content = (
            <span className="flex flex-col items-center gap-1 py-1.5">
              <Icon name={tab.icon} active={active} />
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
