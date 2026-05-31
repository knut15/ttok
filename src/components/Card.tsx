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
      className={`rounded-2xl bg-surface p-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}
