"use client";

// next-auth SessionProvider 를 RSC 루트 레이아웃에서 쓰기 위한 클라이언트 경계.
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { QueryProviderClient } from "@/features/auth/components/QueryProviderClient";
import { CurrentUserSync } from "@/features/auth/components/CurrentUserSync";

export function SessionProviderClient({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  // session: 서버(auth())에서 주입한 초기 세션 → 첫 렌더부터 status 확정(클라 첫 왕복 제거).
  // perf: 기본값(포커스 시 refetch + 주기 polling)은 모바일 웹에서 잦은 탭 포커스마다
  //   GET /api/auth/session 라운드트립을 유발. 표시용 세션은 staleness 허용(서버 가드가 진실원).
  //   포커스 refetch 끄고 5분 주기만 유지(매니저 승격 등 열린 탭 반영).
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false} refetchInterval={300}>
      <CurrentUserSync />
      <QueryProviderClient>{children}</QueryProviderClient>
    </SessionProvider>
  );
}
