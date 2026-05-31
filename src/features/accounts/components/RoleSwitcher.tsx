"use client";

// 역할전환(mock 계정 전환, architect §1.2). /api/crews 목록 → 선택 시 setCurrentUser.
// client 는 store 직접 import 금지 → route 경유.
import { useEffect, useState } from "react";
import type { Crew, User } from "@/types";
import { useCurrentUser } from "@/features/accounts/hooks/useCurrentUser";

const NO_STORE: RequestInit = { cache: "no-store" };

/** Crew(서버 계정) → 클라이언트 현재 사용자(User)로 매핑. */
function crewToUser(crew: Crew): User {
  return {
    id: crew.id,
    name: crew.name,
    role: crew.role,
    avatarInitial: crew.avatarInitial,
    crewId: crew.role === "crew" ? crew.id : undefined,
  };
}

export function RoleSwitcher() {
  const { user, setCurrentUser } = useCurrentUser();
  const [crews, setCrews] = useState<Crew[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/crews", NO_STORE)
      .then((res) => (res.ok ? res.json() : []))
      .then((json: Crew[]) => {
        if (active) setCrews(json);
      });
    return () => {
      active = false;
    };
  }, []);

  if (crews.length === 0) return null;

  return (
    <section className="px-5 pt-8">
      <h2 className="mb-3 text-lg font-bold">계정 전환 (mock)</h2>
      <ul className="space-y-2">
        {crews.map((crew) => {
          const selected = crew.id === user.id;
          return (
            <li key={crew.id}>
              <button
                type="button"
                onClick={() => setCurrentUser(crewToUser(crew))}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                  selected
                    ? "border-coral bg-coral/10"
                    : "border-black/5 bg-surface"
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.06] font-bold">
                  {crew.avatarInitial}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{crew.name}</span>
                  <span className="block text-sm text-muted">
                    {crew.role === "master" ? "마스터(점주)" : "크루"}
                  </span>
                </span>
                {selected && (
                  <span className="text-sm font-semibold text-coral">선택됨</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
