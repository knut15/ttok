// 로그인 페이지(가드 밖). 이미 로그인했으면 가드가 처리하도록 "/"로 보낸다.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginButtons } from "@/features/auth/components/LoginButtons";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/"); // 로그인 상태 → (app) 가드가 온보딩/홈 분기

  const devEnabled =
    process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-center text-2xl font-bold text-coral">Crewmon</h1>
      <p className="mb-8 text-center text-sm text-muted">출퇴근·급여 관리</p>
      <LoginButtons devEnabled={devEnabled} />
    </main>
  );
}
