// Auth.js(NextAuth v5) 설정 — Google 실로그인 + loc/dev 우회 로그인(Credentials).
// 세션 전략 = JWT(Credentials 필수). Prisma adapter 는 Google(OAuth) User/Account 영속에 사용.
// scope 클레임(role/storeId/membershipId/operationalId/isManager)을 토큰에 스탬프 →
// session-scope 브리지가 이를 읽어 인메모리 store 의 crewId 로 매핑.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/** dev 우회 로그인은 비-prod + 명시 플래그일 때만(이중 차단 → prod 누출 불가). */
const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "1";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    // 카카오 — 카카오톡 인앱 브라우저 안에서도 로그인 동작(구글은 인앱브라우저에서 차단됨).
    // 같은 email 이면 구글 계정과 자동 링크(allowDangerousEmailAccountLinking). 단 카카오는
    // email 동의항목이 선택이라 미제공일 수 있음 → 그 경우 별도 User 로 생성된다.
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev Login",
            credentials: { email: {}, name: {} },
            async authorize(creds) {
              const email = String(creds?.email ?? "").trim() || "dev@crewmon.local";
              const name = String(creds?.name ?? "") || email.split("@")[0];
              // 실 User 를 upsert → 멤버십 조회가 Google 흐름과 동일하게 동작.
              const user = await prisma.user.upsert({
                where: { email },
                update: {},
                create: { email, name },
              });
              return { id: user.id, email: user.email, name: user.name };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) token.sub = user.id;
      // 멤버십 클레임 캐싱(perf): 매 요청 DB 조회 대신 토큰에 캐시하고 TTL(60s)마다만 갱신.
      //   jwt 콜백은 모든 auth() 호출(=모든 API 라우트 resolveScope + 세션 조회)마다 발화하므로
      //   "매 요청 갱신"은 요청당 Neon 왕복 1회를 강제 → prod 지연의 주범. TTL 로 그 세금을 제거.
      //   refresh 조건: 최초 로그인(user) · 명시적 update() · 클레임 미보유 · TTL 경과.
      //   온보딩 완료/매니저 승격은 최대 60s 지연 — 보호 페이지 진입은 guard.ts 가 멤버십을 직접 조회하므로
      //   라우팅·권한 게이트는 즉시 반영(클레임 표시값만 지연). 즉시 갱신 필요 시 update() 트리거.
      const REFRESH_MS = 60_000;
      const claimsAt = Number(token.claimsAt ?? 0);
      const stale = Date.now() - claimsAt > REFRESH_MS;
      const needsRefresh =
        Boolean(user?.id) || trigger === "update" || token.claimsAt == null || stale;
      if (token.sub && needsRefresh) {
        const m = await prisma.membership.findFirst({
          where: { userId: token.sub, active: true },
          orderBy: { createdAt: "asc" },
        });
        token.role = (m?.role as "master" | "crew" | undefined) ?? null;
        token.storeId = m?.storeId ?? null;
        token.membershipId = m?.id ?? null;
        token.operationalId = m?.operationalId ?? null;
        token.isManager = m?.isManager ?? false;
        token.claimsAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.role = (token.role as "master" | "crew" | null) ?? null;
      session.storeId = (token.storeId as string | null) ?? null;
      session.membershipId = (token.membershipId as string | null) ?? null;
      session.operationalId = (token.operationalId as string | null) ?? null;
      session.isManager = (token.isManager as boolean) ?? false;
      return session;
    },
  },
});
