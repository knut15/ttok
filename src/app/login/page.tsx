// 로그인 페이지(가드 밖). 이미 로그인했으면 가드/온보딩이 처리하도록 보낸다.
// 합류 링크(?invite=CODE)로 들어오면 코드를 온보딩까지 전달.
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { userExists } from "@/lib/identity-repo";
import { LoginButtons } from "@/features/auth/components/LoginButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const session = await auth();
  // 유효한 세션(DB에 user 실존)만 리다이렉트. 유령/만료 세션이면 로그인 버튼 노출(재로그인).
  if (session?.user?.id && (await userExists(session.user.id))) {
    redirect(invite ? `/onboarding?invite=${encodeURIComponent(invite)}` : "/");
  }

  const devEnabled =
    process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

  return (
    <main className="mx-auto flex min-h-dvh w-full flex-col justify-center px-6">
      <h1 className="mb-1 text-center text-2xl font-bold text-coral">Crewmon</h1>
      <p className="mb-8 text-center text-sm text-muted">출퇴근·급여 관리</p>
      {invite && (
        <p className="mb-4 rounded-3xl bg-coral/10 px-4 py-3 text-center text-sm text-coral">
          초대 코드 <b className="tracking-widest">{invite}</b> 로 합류합니다. 먼저 로그인하세요.
        </p>
      )}
      <LoginButtons devEnabled={devEnabled} invite={invite} />
    </main>
  );
}
