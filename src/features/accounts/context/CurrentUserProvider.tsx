"use client";

// 현재 사용자 Context (architect §2.4, §4 하이드레이션 mount-gate).
// 초기 state = 김민정(crew-minjung, role crew) → 서버/CSR 1차 렌더 동일(mismatch 0).
// localStorage 는 mount 후 useEffect 에서만 읽어 복원(초기 useState 에서 읽지 않음).
import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/types";
import { DEFAULT_CREW_ID } from "@/lib/constants";

/** 서버/CSR 1차 동일 초기값 — 하이드레이션 mismatch 0. */
export const INITIAL_USER: User = {
  id: DEFAULT_CREW_ID,
  name: "김민정",
  role: "crew",
  avatarInitial: "김",
  crewId: DEFAULT_CREW_ID,
};

const STORAGE_KEY = "crewmon.currentUser";

export interface CurrentUserContextValue {
  user: User;
  setCurrentUser: (user: User) => void;
}

export const CurrentUserContext = createContext<CurrentUserContextValue | null>(
  null,
);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  // 초기값은 항상 김민정(localStorage 미참조) → SSR/CSR 1차 렌더 동일.
  const [user, setUser] = useState<User>(INITIAL_USER);

  // mount 후에만 localStorage(외부 시스템)에서 복원(하이드레이션 안전, T6 mount-gate).
  // 초기 useState 에서 읽으면 SSR/CSR mismatch → 반드시 mount 후 1회만. 이것이 본 규칙의 의도된 예외.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 시스템(localStorage) 1회 동기화, mount-gate 필수.
      if (raw) setUser(JSON.parse(raw) as User);
    } catch {
      // 손상/차단 시 김민정 유지.
    }
  }, []);

  const setCurrentUser = useCallback((next: User) => {
    setUser(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장 실패해도 state 는 갱신(휘발 허용).
    }
  }, []);

  return (
    <CurrentUserContext.Provider value={{ user, setCurrentUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}
