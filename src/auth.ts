// Auth.js(NextAuth v5) 설정 — Google 실로그인 + loc/dev 우회 로그인(Credentials).
// 세션 전략 = JWT(Credentials 필수). Prisma adapter 는 Google(OAuth) User/Account 영속에 사용.
// scope 클레임(role/storeId/membershipId/operationalId/isManager)을 토큰에 스탬프 →
// session-scope 브리지가 이를 읽어 인메모리 store 의 crewId 로 매핑.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
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
      // 멤버십 클레임 스탬프: 로그인/세션 갱신/아직 멤버십 미보유(온보딩 전) 시 재조회.
      // 멤버십을 한번 얻으면 membershipId 캐시 → 이후 요청은 추가 쿼리 없음.
      if (token.sub && (user || trigger === "update" || !token.membershipId)) {
        const m = await prisma.membership.findFirst({
          where: { userId: token.sub, active: true },
          orderBy: { createdAt: "asc" },
        });
        token.role = (m?.role as "master" | "crew" | undefined) ?? null;
        token.storeId = m?.storeId ?? null;
        token.membershipId = m?.id ?? null;
        token.operationalId = m?.operationalId ?? null;
        token.isManager = m?.isManager ?? false;
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
