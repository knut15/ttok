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
      className={`rounded-3xl bg-surface p-5 shadow-[0_2px_16px_rgba(82,60,40,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}
