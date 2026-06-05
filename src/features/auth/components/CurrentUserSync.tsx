"use client";

// 세션 → currentUser zustand store 동기화 마운트 포인트(렌더 없음).
// SessionProvider 내부에 1회 배치(useSession 사용 위해).
import { useCurrentUserSync } from "@/features/accounts/hooks/useCurrentUser";

export function CurrentUserSync(): null {
  useCurrentUserSync();
  return null;
}
