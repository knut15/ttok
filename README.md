This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 개발 셋업 (인증 · DB)

실제 구글 로그인 + 마스터 가입(사업자/매장) + 초대 합류은 Auth.js(NextAuth v5) + Prisma(Postgres)로 동작한다(ADR 0008). DB는 dev·prod 모두 Postgres(approach A).

```bash
cp .env.example .env          # AUTH_SECRET 채우기: pnpm dlx auth secret
docker compose up -d          # 로컬 Postgres(localhost:5433)
pnpm db:migrate               # 스키마 마이그레이션 적용
pnpm db:seed                  # 데모 매장 + 멤버십 시드(dev 로그인 착지점)
pnpm dev
```

- loc/dev: `AUTH_DEV_LOGIN=1` 이면 `/login`에서 **개발용 로그인**(테스트 계정 즉시 로그인) 가능. `BIZ_VALIDATION=off`라 사업자번호·매장명 아무거나 허용.
- 실제 구글 로그인: `GOOGLE_CLIENT_ID/SECRET`을 `.env`에 넣으면 즉시 동작.
- prod(Vercel): Storage→Postgres 생성 시 주입되는 `POSTGRES_PRISMA_URL`→`DATABASE_URL`, `POSTGRES_URL_NON_POOLING`→`DIRECT_URL` 로 설정. 빌드 커맨드에 `prisma generate && prisma migrate deploy && next build`. `BIZ_VALIDATION=checksum|nts`, `AUTH_DEV_LOGIN` 제거.

> Prisma CLI가 회사 TLS 프록시로 엔진 다운로드에 실패하면 `NODE_OPTIONS=--use-system-ca pnpm db:migrate`로 실행.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
