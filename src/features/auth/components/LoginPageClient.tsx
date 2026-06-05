"use client";

import { useSearchParams } from "next/navigation";
import { LoginButtons } from "@/features/auth/components/LoginButtons";

export function LoginPageClient({ devEnabled }: { devEnabled: boolean }) {
  const searchParams = useSearchParams();
  const invite = searchParams.get("invite") ?? undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col justify-center px-6">
      <h1 className="mb-1 text-center text-2xl font-bold text-coral">Crewmon</h1>
      <p className="mb-8 text-center text-sm text-muted">출퇴근·급여 관리</p>
      {invite && (
        <p className="mb-4 rounded-2xl bg-coral/10 px-4 py-3 text-center text-sm text-coral">
          초대 코드 <b className="tracking-widest">{invite}</b> 로 합류합니다. 먼저 로그인하세요.
        </p>
      )}
      <LoginButtons devEnabled={devEnabled} invite={invite} />
    </main>
  );
}
