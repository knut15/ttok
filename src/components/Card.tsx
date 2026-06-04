// 라운드 카드 컨테이너(AC-19c). presentational, 도메인 비의존.
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(28,24,20,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}
