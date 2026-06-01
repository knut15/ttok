"use client";

// 초대 플로우 훅(T8-6). 마스터=생성 / 멤버=합류. authHeaders 로 현재 사용자 전달.
// client 는 store 직접 import 금지 → route 경유(/api/invites, /api/invites/join).
import { useState } from "react";
import type { Invite, JoinResult } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

export interface UseInvitesResult {
  /** 마스터: 초대 생성 → 발급된 코드(state). */
  createdCode: string | null;
  /** 멤버: 합류 결과(성공 메시지/에러). */
  joinMessage: string | null;
  joinOk: boolean;
  loading: boolean;
  createInvite: () => Promise<void>;
  joinByCode: (code: string) => Promise<void>;
}

export function useInvites(): UseInvitesResult {
  const { user } = useCurrentUser();
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [joinOk, setJoinOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function createInvite() {
    setLoading(true);
    setCreatedCode(null);
    try {
      const res = await fetch("/api/invites", {
        ...NO_STORE,
        method: "POST",
        headers: authHeaders(user),
      });
      if (res.ok) {
        const invite = (await res.json()) as Invite;
        setCreatedCode(invite.code);
      } else {
        setCreatedCode(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function joinByCode(code: string) {
    setLoading(true);
    setJoinMessage(null);
    setJoinOk(false);
    try {
      const res = await fetch("/api/invites/join", {
        ...NO_STORE,
        method: "POST",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify({ code, crewId: user.crewId ?? user.id }),
      });
      if (res.ok) {
        const result = (await res.json()) as JoinResult;
        setJoinOk(true);
        setJoinMessage(`합류 완료: ${result.crew.name} (활성화됨)`);
      } else if (res.status === 409) {
        setJoinMessage("이미 사용된 초대 코드입니다.");
      } else {
        setJoinMessage("유효하지 않은 초대 코드입니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    createdCode,
    joinMessage,
    joinOk,
    loading,
    createInvite,
    joinByCode,
  };
}
