// 현재 사용자 클라이언트 전역 상태(zustand).
// 진실원은 여전히 next-auth 세션 — useCurrentUserSync 가 세션→이 store 로 파생값을 밀어넣고,
// 소비처(useCurrentUser)는 이 store 만 읽는다. (세션 직접 구독을 한 곳으로 모아 재렌더/중복 fetch 감소.)
import { create } from "zustand";
import type { User } from "@/types";

/** 세션 로딩/비로그인 시 임시 폴백(가드 통과 후 (app) 에서는 실제로 노출되지 않음). */
export const INITIAL_USER: User = {
  id: "guest",
  name: "",
  role: "crew",
  avatarInitial: "",
  crewId: "guest",
  isManager: false,
};

interface CurrentUserState {
  user: User;
  setUser: (user: User) => void;
}

export const useCurrentUserStore = create<CurrentUserState>((set) => ({
  user: INITIAL_USER,
  setUser: (user) => set({ user }),
}));
