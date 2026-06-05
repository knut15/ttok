// 로그인 페이지(가드 밖). 이미 로그인했으면 가드/온보딩이 처리하도록 보낸다.
// 합류 링크(?invite=CODE)로 들어오면 코드를 온보딩까지 전달.
import { Suspense } from "react";
import { LoginPageClient } from "@/features/auth/components/LoginPageClient";

export default function LoginPage() {
  const devEnabled =
    process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

  return (
    <Suspense>
      <LoginPageClient devEnabled={devEnabled} />
    </Suspense>
  );
}
