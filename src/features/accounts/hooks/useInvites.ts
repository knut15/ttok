"use client";

// 초대 관리 훅(마스터). 발급/목록/회수. client 는 route 경유(/api/invites).
import { useCallback, useEffect, useState } from "react";
import type { Invite, StoreInvite } from "@/types";
import {
  authHeaders,
  useCurrentUser,
} from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

export interface UseInvitesResult {
  /** 직전 발급 코드(강조 표시용). */
  createdCode: string | null;
  /** 매장 발급 이력(최신순). */
  invites: StoreInvite[];
  loading: boolean;
  createInvite: () => Promise<void>;
  revoke: (code: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useInvites(): UseInvitesResult {
  const { user } = useCurrentUser();
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<StoreInvite[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/invites", { ...NO_STORE, headers: authHeaders(user) });
    if (res.ok) {
      const json = (await res.json()) as { invites: StoreInvite[] };
      setInvites(json.invites ?? []);
    }
  }, [user]);

  // 마운트/사용자 변경 시 목록 로드(setState 는 .then 콜백에서 — 외부시스템 동기화).
  useEffect(() => {
    let active = true;
    fetch("/api/invites", { ...NO_STORE, headers: authHeaders(user) })
      .then((res) => (res.ok ? (res.json() as Promise<{ invites: StoreInvite[] }>) : null))
      .then((json) => {
        if (active && json) setInvites(json.invites ?? []);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.role]);

  const createInvite = useCallback(async () => {
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
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  }, [user, refresh]);

  const revoke = useCallback(
    async (code: string) => {
      const res = await fetch("/api/invites", {
        ...NO_STORE,
        method: "DELETE",
        headers: { ...authHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        if (createdCode === code) setCreatedCode(null);
        await refresh();
      }
    },
    [user, refresh, createdCode],
  );

  return { createdCode, invites, loading, createInvite, revoke, refresh };
}
