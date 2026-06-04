# 배포 가이드 — Vercel + Neon(Postgres) + Google·Kakao 로그인

> **프로덕션 URL: https://ttok-nine.vercel.app** (Vercel 프로젝트 `ttok`).
> `main` 브랜치 push → Vercel 자동 배포.

이 문서대로 하면 GitHub(`knut15/ttok`) → Vercel 자동 배포 + Neon Postgres 연결이 끝난다.

## 0. 사전 준비
- 코드가 GitHub `main` 에 push 되어 있어야 한다(Vercel Git 연동).
- 빌드는 `pnpm build` = `prisma generate && prisma migrate deploy && next build`.
  → 배포할 때마다 prod DB에 마이그레이션이 자동 적용된다(테이블 자동 생성).

## 1. Vercel 프로젝트 생성
1. https://vercel.com → **Add New… → Project** → `knut15/ttok` import.
2. Framework: **Next.js**(자동 감지). Build/Install 명령은 기본값 그대로(우리 `build` 스크립트 사용).
3. 일단 **Deploy** 누르지 말고(또는 첫 빌드 실패해도 무방) 먼저 2~4단계로 환경변수·DB를 채운다.

## 2. Neon Postgres 연결
1. 프로젝트 → **Storage → Create Database → Neon** 선택해 생성/연결.
2. 연결되면 Neon이 프로젝트에 환경변수를 **자동 주입**한다(모든 환경):
   - `DATABASE_URL` — 풀링(pooler) 연결. **앱 런타임용**.
   - `DATABASE_URL_UNPOOLED` — 직결(non-pooled). **마이그레이션용**.
3. Prisma 스키마가 이 **두 이름을 그대로 읽으므로 수동 매핑이 필요 없다**(과거에 만들었던 `DIRECT_URL` 수동 변수는 지워도 됨).
4. (선택) prepared statement 충돌이 보이면 `DATABASE_URL` 끝에 `&pgbouncer=true&connection_limit=1` 추가.

> 핵심: 앱=`DATABASE_URL`(pooler), 마이그레이션=`DATABASE_URL_UNPOOLED`(직결). 둘 다 Neon이 자동 제공.

## 3. 인증(NextAuth) 환경변수
프로젝트 → Settings → Environment Variables 에 추가:

| 키 | 값 | 비고 |
|---|---|---|
| `AUTH_SECRET` | `pnpm dlx auth secret` 또는 `openssl rand -base64 32` 결과 | **필수**. 없으면 로그인 동작 안 함 |
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | 4단계에서 발급 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 시크릿 | 4단계에서 발급 |
| `KAKAO_CLIENT_ID` | Kakao REST API 키 | 4.5단계에서 발급 |
| `KAKAO_CLIENT_SECRET` | Kakao Client Secret | 4.5단계에서 발급 |
| `BIZ_VALIDATION` | `off` | 데모는 off(아무 사업자번호 허용). 실검증 시 `nts`+`NTS_SERVICE_KEY` |

- **`AUTH_DEV_LOGIN` 은 설정하지 말 것**(prod 데모 우회 로그인은 코드가 `NODE_ENV=production` 으로 이중 차단).
- `AUTH_URL` 은 보통 불필요(Vercel 도메인 자동 감지, trustHost). 커스텀 도메인만 쓰면 `AUTH_URL=https://<도메인>` 지정.

## 4. Google OAuth 클라이언트 발급
1. https://console.cloud.google.com → APIs & Services → **OAuth consent screen** 설정(External, 테스트 사용자 등록).
2. **Credentials → Create Credentials → OAuth client ID → Web application**.
3. **Authorized redirect URIs** 에 prod 콜백 추가:
   ```
   https://ttok-nine.vercel.app/api/auth/callback/google
   ```
   (커스텀 도메인 쓰면 그 도메인도 추가. Preview 배포는 URL이 매번 바뀌어 OAuth가 안 되므로 프로덕션 도메인 기준.)
4. 발급된 ID/Secret 을 3단계 `GOOGLE_CLIENT_ID/SECRET` 에 입력.

> ⚠️ 구글은 **카톡/네이버 등 인앱 브라우저 안에서의 로그인을 차단**(`disallowed_useragent`)한다.
> 일반 브라우저에서만 동작 → 인앱 유입 대응으로 **카카오 로그인을 함께 제공**(4.5단계).

## 4.5 Kakao OAuth 클라이언트 발급 (인앱 브라우저 대응)
카카오 로그인은 **카카오톡 인앱 브라우저 안에서도 동작**한다(구글이 막히는 환경 대응).

1. https://developers.kakao.com → 앱 생성 → **[카카오 로그인] 활성화 ON**.
2. 키 매핑:
   - **[앱 키] REST API 키** → `KAKAO_CLIENT_ID`
   - **[카카오 로그인] → [보안] → Client Secret 코드 생성 + 활성화 ON** → `KAKAO_CLIENT_SECRET`
3. **[카카오 로그인] → [Redirect URI]** 에 등록(로컬·prod 둘 다):
   ```
   http://localhost:3000/api/auth/callback/kakao
   https://ttok-nine.vercel.app/api/auth/callback/kakao
   ```
4. **[동의항목] → 카카오계정(이메일) → 필수 동의**(구글 계정과 email 기준 자동 링크에 필요).
   필수 동의는 **비즈앱 전환**([앱 설정] → [비즈니스], 사업자등록번호) 필요. 미설정 시 email이 null → 별도 계정 생성.

## 5. 배포
- 환경변수 저장 후 **Deployments → Redeploy**(또는 `main` 에 새 커밋 push).
- 빌드 로그에서 `prisma migrate deploy` 가 마이그레이션 5개(+ payslip_input) 적용하는지 확인.
- 완료 후 `https://ttok-nine.vercel.app` 접속 → `/login` → **Google·Kakao 로그인** → 멤버십이 없으면 `/onboarding`(매장 생성)으로 이동.
- 키 적용은 순서 주의: Vercel 환경변수 저장 → **그 다음** 재배포(빈 커밋/Redeploy)해야 빌드가 값을 집어간다. 키 넣기 전에 재배포하면 그 provider만 prod에서 실패한다.

## 6. (선택) 데모 데이터 시드
prod는 빈 DB로 시작하며, 실제 사용자는 Google 로그인 후 온보딩으로 직접 매장/데이터를 만든다.
데모 데이터(김민정 등 출퇴근/급여 샘플)를 prod에 넣고 싶을 때만, **로컬에서 prod DB를 가리켜** 1회 실행:

```bash
# prod Neon 의 직결 URL을 양쪽에 넣고 시드(주의: prod 데이터 변경)
DATABASE_URL="<prod DATABASE_URL_UNPOOLED>" DATABASE_URL_UNPOOLED="<prod DATABASE_URL_UNPOOLED>" pnpm db:seed:prod
```

> 데모 멤버십은 `operationalId`(crew-minjung 등) 기반이라, 실제 Google 계정과는 연결되지 않는다.
> 즉 데모 데이터는 "구경용"이고, 본인 계정 흐름은 온보딩부터 새로 시작한다.

## 7. 로컬 개발(참고)
```bash
docker compose up -d         # localhost:5433 Postgres
pnpm install                 # postinstall 로 prisma generate
pnpm db:migrate              # 로컬 마이그레이션
pnpm db:seed                 # 데모 시드(dev 우회 로그인이 바로 착지)
pnpm dev
```

## 트러블슈팅
- **`prisma.<model> is undefined` / `findUnique` 에러**: Prisma Client가 stale. 재배포(=재install로 `prisma generate`) 또는 로컬은 dev 서버 재시작.
- **빌드 단계 `migrate deploy` 실패(`Environment variable not found: DATABASE_URL_UNPOOLED`)**: Neon이 프로젝트에 연결됐는지, 해당 변수가 **Production 환경**에 있는지 확인(2).
- **로그인 후 무한 `/login`**: `AUTH_SECRET` 누락 또는 Google redirect URI 불일치(4-3).
- **런타임 DB 연결 에러(prepared statement)**: `DATABASE_URL` 에 `pgbouncer=true&connection_limit=1` 추가.
