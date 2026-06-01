// 온보딩 페이지(가드 밖). 미로그인 → /login, 이미 멤버십 보유 → /(홈).
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findActiveMembership } from "@/lib/identity-repo";
import { OnboardingForm } from "@/features/auth/components/OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (await findActiveMembership(session.user.id)) redirect("/");

  return (
    <main className="min-h-dvh">
      <OnboardingForm />
    </main>
  );
}
