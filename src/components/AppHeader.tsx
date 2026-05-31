// 브랜드/날짜/매장명 헤더(presentational). variant 로 홈 브랜드 헤더 / 일반 타이틀 구분.
import type { ReactNode } from "react";

export function AppHeader({
  brand,
  title,
  right,
}: {
  brand?: boolean;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-4">
      {brand ? (
        <span className="text-2xl font-extrabold tracking-tight text-foreground">
          Crewmon
        </span>
      ) : (
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      )}
      {right}
    </header>
  );
}
