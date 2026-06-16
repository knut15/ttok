# ttok — Crewmon 출퇴근·급여 앱 클론

Next.js 16(App Router) + Prisma/Postgres + Auth.js(NextAuth v5) + Tailwind v4. 패키지 매니저는 **pnpm**.
모바일 세로 전용 UI(바텀 탭: 홈/출퇴근/급여/마이페이지). 구조는 feature-based —
도메인 코드 `src/features/<domain>/`, 공용 UI `src/components/`, 계산·store·util `src/lib/`, 라우팅·API `src/app/`.

## 단일 출처 문서

- `CONTEXT.md` — **도메인 캐논**. 근무시간·휴게·연장·차감·주휴수당 등 모든 용어/산식의 단일 출처.
- `docs/adr/` — 설계 결정 기록. 규칙이 왜 그렇게 정해졌는지는 여기.
- `DEPLOY.md` — Vercel+Neon 배포·OAuth 발급 절차. prod: https://ttok-nine.vercel.app (`main` push = 자동 배포).
- `DESIGN.md` — 디자인 시스템(Premium Monotone).

## 로컬 개발

기동·시드·데모 로그인·QA 뷰포트는 **dev-run 스킬**(`.claude/skills/dev-run/`)을 따른다. 요약:
`docker compose up -d`(Postgres 5433) → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`. dev 로그인은 `AUTH_DEV_LOGIN=1`.

- 테스트: `pnpm test` (vitest). 전용 DB `ttok_test`(5433, globalSetup이 자동 마이그레이션) — dev DB와 분리라 dev 데이터에 영향 없다.
- `pnpm db:seed`는 데모 매장의 **운영 데이터를 전부 삭제 후 재삽입**한다. dev DB에 검증 중인 데이터가 있으면 날아가므로 함부로 돌리지 말 것.
- 회사 TLS 프록시로 Prisma 엔진 다운로드가 실패하면 `NODE_OPTIONS=--use-system-ca` 를 붙여 실행.

## 급여·근태 규칙 가드 (중요)

이 레포 회귀의 대부분은 산식·판정 불일치에서 나왔다(연장 오산정 → ADR 0001/0003, 결근 vs 휴가 차감 정책 등).
`src/lib/{time,pay,payslip,attendance-rules}.ts` 등 판정·산식 코드를 바꿀 때:

1. **변경 전** CONTEXT.md의 해당 항목과 관련 ADR을 먼저 읽는다.
2. **변경 후** 검산 테스트를 추가한다 (기준 검산 예: 390분 × 10,320원 = 67,080원).
3. CONTEXT.md를 **같은 커밋에서** 갱신한다 — 코드와 캐논이 어긋난 채 두지 않는다.
4. 판정 규칙이 바뀌면 기존 DB 레코드 재판정이 필요한지 검토한다 → **recompute 스킬**(`.claude/skills/recompute/`).

## 커밋 컨벤션

- 한국어 conventional commit: `type(scope): 요약` (예: `feat(pay): …`, `fix(attendance): …`, `perf(client): …`).
- Claude co-author 트레일러(`Co-Authored-By: Claude …`)는 넣지 않는다.
