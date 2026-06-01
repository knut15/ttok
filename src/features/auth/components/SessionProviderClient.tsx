"use client";

// next-auth SessionProvider 를 RSC 루트 레이아웃에서 쓰기 위한 클라이언트 경계.
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function SessionProviderClient({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
