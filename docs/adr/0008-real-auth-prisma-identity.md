# ADR 0008 — 실제 인증(Auth.js) + Prisma 신원 레이어 + 세션 기반 scope

Date: 2026-06-01
Status: Accepted

## Context

ADR 0001(인메모리 store)·ADR 0005(localStorage mock 역할전환, `x-role`/`x-crew-id` 헤더 scope)는
디자인·동작 데모를 위한 신뢰 모델이었다. 누구나 역할을 토글할 수 있고, 인증·영속성은 명시적 비목표였다.

다음 단계 요구사항으로 **실제 신뢰 모델**이 필요해졌다:
- 실제 구글 로그인으로만 진입.
- **마스터**는 구글 로그인과 함께 사업자등록번호 + 매장 정보를 입력해 자기 매장(테넌트)을 만든다.
- **멤버(크루)**는 마스터가 발급한 **초대코드로만** 합류(임의 가입 불가).
- loc/dev는 테스트 사업자번호·매장명 허용(검증 생략), prod는 검증.

제약: 기존 306개 테스트(헤더 기반 scope·인메모리 store 단언)를 회귀 없이 유지해야 한다.

## Decision

### ① 영속성 = Prisma + SQLite, 범위는 "신원/테넌트 레이어"로 한정
- DB(`prisma/schema.prisma`)에는 **User·Account·Session·VerificationToken(Auth.js 표준) + Store·Membership·Invite**만 둔다.
- 운영 데이터(출퇴근/스케줄/급여/고정근무/알림)는 **여전히 인메모리 store**가 진실원(ADR 0001 유지). 후속 스텝에서 이관.
- 브리지: `Membership.operationalId`(데모는 `crew-minjung`/`master-1` 등, 신규 실매장은 null)가 인메모리 store의 `crewId` 공간으로 매핑.
- dev=SQLite, prod=Postgres(스키마 `provider`만 교체). 타입은 Postgres 호환만 사용. Prisma 6 핀(7은 datasource `url` 폐지·driver adapter 강제로 마찰 → 6 채택).

### ② 인증 = Auth.js(NextAuth v5) JWT 세션 + Google + loc/dev 우회 로그인
- `src/auth.ts`: `PrismaAdapter` + `session.strategy="jwt"`(Credentials 필수). Google provider는 항상 등록(자격증명 .env 주입 시 즉시 동작).
- **dev 우회 로그인**(Credentials, id="dev")은 `NODE_ENV!=="production" && AUTH_DEV_LOGIN==="1"` 이중 가드일 때만 등록 → prod 누출 불가.
- `jwt`/`session` 콜백이 멤버십 클레임(role·storeId·membershipId·operationalId·isManager)을 토큰에 스탬프. 멤버십 미보유(온보딩 전)면 매 요청 재조회, 보유하면 캐시.

### ③ scope = 세션 우선 + 헤더 폴백(회귀 0의 키스톤)
- `src/lib/session-scope.ts` `resolveScope(req)`: Auth.js 세션이 있으면 세션 기반 scope(`crewId = operationalId ?? userId`), 없으면 기존 `readScope(req)` 폴백.
- 라우트 핸들러 17개를 `readScope` → `await resolveScope`로 기계적 치환. `enforceReadScope`·403 마스터 게이트·`src/lib/scope.ts`는 무수정.
- **테스트는 세션 쿠키가 없으므로 항상 폴백 → 기존 동작·단언과 바이트 동일**(회귀 0).
- `auth`는 `resolveScope`에서 **동적 import** — next-auth 정적 import 체인이 라우트로 번져 vitest ESM 해석을 깨는 것을 방지(실패 시 catch→폴백).

### ④ 온보딩 + 가드
- `(app)` 라우트 그룹 레이아웃에서 서버 가드 `requireMembership()`: 미로그인→`/login`, 멤버십 없음→`/onboarding`.
  Next 16은 `middleware.ts`→`proxy.ts` 리네임 + Auth.js `authorized` 콜백 미발화 → **서버 컴포넌트 가드를 진실원**으로.
- `POST /api/onboarding/store`(마스터 가입), `POST /api/onboarding/join`(초대 합류), `POST /api/invites`(세션이면 Prisma 초대, 아니면 레거시 인메모리). 신원 로직은 `src/lib/identity-repo.ts`로 격리(테스트 시 mock).
- 사업자번호: `src/lib/biz-number.ts` 순수 검증 + env `BIZ_VALIDATION`(off=dev 무조건 통과 | checksum | nts(prod TODO)).

### ⑤ mock 역할전환 제거
- `CurrentUserProvider`(localStorage)·`RoleSwitcher` 제거. `useCurrentUser`는 `useSession` 위에 재구현(반환 `User` 형태·import 경로 유지 → 소비처 무수정). 계정 전환=재로그인(`/mypage` 로그아웃).
- `authHeaders`는 유지(세션 존재 시 서버가 무시 → 무해, 폴백 호환).

## Consequences
- 실제 구글/dev 로그인 → 세션 → scope → 인메모리 store 데이터까지 end-to-end 동작(데모 마스터가 시드 집계 조회 검증). 317 테스트 GREEN(기존 306 + 신규 11), lint·build 통과.
- (+) prod 전환은 DB provider + GOOGLE_* + AUTH_SECRET + BIZ_VALIDATION 설정만으로 가능.
- (−) 운영 데이터는 아직 인메모리(재시작 시 휘발). 신규 실매장은 운영 데이터 빈 상태에서 시작 — 이관은 후속.
- (−) 멀티매장(한 User 여러 Membership) 전환 UI 미구현(단일 매장 전제, `findActiveMembership` 최초 1건).
- 한계: 실제 국세청 진위확인 미연동(env-gated stub), 초대 만료·회수 미구현.

## Alternatives Considered
- **Prisma 7**: datasource `url` 폐지 + `prisma.config.ts`·driver adapter(better-sqlite3 네이티브) 강제 → 빌드/인증서 마찰. Prisma 6 채택.
- **운영 데이터까지 DB 이관**: 범위 과대(회귀 위험·시간). 신원 레이어로 한정하고 후속 스텝으로 분리.
- **헤더 scope를 세션으로 전면 교체**: 306 테스트 대량 보정 필요. 세션 우선 + 헤더 폴백으로 회귀 0 유지.
- **proxy.ts(middleware) 기반 보호**: Next 16에서 Auth.js `authorized` 콜백 미발화·DB 접근 불가(edge). 서버 컴포넌트 가드 채택.
- **DB 세션 전략**: Credentials provider와 비호환. JWT 전략 채택(Session 테이블은 adapter 계약상 유지).
