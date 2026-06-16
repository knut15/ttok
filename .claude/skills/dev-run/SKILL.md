---
name: dev-run
description: >
  ttok(Crewmon 출퇴근·급여 앱)의 로컬 기동·시드·데모 로그인 절차. 앱을 실행·재시작하거나,
  화면 확인·스크린샷·browse QA·verify 등 로컬에서 동작을 확인해야 하거나, 데모 데이터를
  리셋해야 하는 모든 작업에서 가장 먼저 이 스킬을 따른다. "앱 띄워줘", "로컬에서 확인해줘",
  "이거 동작하는지 봐줘", "QA 해줘", "스크린샷 찍어줘"처럼 스킬 이름을 언급하지 않아도
  로컬 앱이 필요하면 사용하라. 페르소나(마스터/매니저/멤버) 전환, 모바일 뷰포트,
  dev·테스트 DB 분리 정보를 담고 있다.
---

# dev-run — 로컬 기동 + 데모 페르소나

## 0. 상태 확인 (중복 기동 방지)

이미 떠 있는 경우가 많다. 기동 명령을 치기 전에 먼저 확인한다:

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000   # 200이면 dev 서버 살아있음
docker ps --filter name=ttok-pg --format '{{.Status}}'                      # Postgres 컨테이너 상태
```

dev 서버가 200을 주면 곧장 4번(로그인/QA)으로 간다. 떠 있는 서버를 죽이고 재기동하지 않는다 —
사용자가 띄워둔 세션일 수 있다. 코드 변경 반영은 HMR이 처리하고, Prisma 스키마 변경 등
재시작이 정말 필요할 때만 사용자에게 알리고 재시작한다.

## 1. 선행 조건

- `.env` 가 있어야 한다. 없으면 `cp .env.example .env` 후 `AUTH_SECRET`을 채운다(`pnpm dlx auth secret`).
  키 발급·진단이 필요하면 글로벌 **env-setup 스킬**로 위임한다.
- dev 우회 로그인은 `.env`의 `AUTH_DEV_LOGIN="1"` 이 전제다(prod에서는 코드가 이중 차단).

## 2. 기동 시퀀스

```bash
docker compose up -d     # 로컬 Postgres → localhost:5433 (컨테이너명 ttok-pg)
pnpm install             # node_modules 없을 때만. postinstall이 prisma generate 수행
pnpm db:migrate          # 스키마 마이그레이션 적용
pnpm db:seed             # 데모 시드 — ⚠️ 아래 5번 경고 먼저 읽을 것
pnpm dev                 # http://localhost:3000 (백그라운드로 실행)
```

회사 TLS 프록시로 Prisma 엔진 다운로드가 실패하면: `NODE_OPTIONS=--use-system-ca pnpm db:migrate`.

> ⚠️ **기존 dev DB에 보존해야 할 데이터가 있으면 `pnpm db:migrate`를 쓰지 말 것.** 이건 `prisma migrate dev`라
> drift를 감지하면 DB reset(전체 삭제 + 자동 재시드)을 유도해 수동 입력·재판정 데이터가 날아간다. 데이터 보존이
> 중요한 경우(어제 넣어둔 데이터 유지, prod-like DB 등)에는 `pnpm exec prisma migrate status`로 먼저 확인하고
> pending이 있으면 reset 없이 적용만 하는 `pnpm exec prisma migrate deploy`를 쓴다. 빈 DB·새 환경이면 `pnpm db:migrate` 그대로 OK.

## 3. 데모 로그인 — 페르소나

`/login` 하단 "개발용 로그인 (loc/dev)" 섹션에서 클릭 한 번으로 전환한다.

| 버튼 | 이메일 | 역할 | 이럴 때 사용 |
|---|---|---|---|
| 박점주 (마스터) | owner@crewmon.local | master | 마스터 대시보드(`/master`), 수정요청 수락, 전체 크루 집계 |
| 김민정 (매니저) | minjung@crewmon.local | crew + 매니저 | 크루 화면 전반. **운영 데이터(출퇴근·급여)가 가장 풍부한 계정** — 기본 QA 페르소나 |
| 이서연 (멤버) | seoyeon@crewmon.local | crew | 일반 크루(매니저 권한 없음) 관점 검증 |

- 추가 시드 크루: 박지훈 `jihun@crewmon.local`, 최유진 `yujin@crewmon.local` — 버튼은 없고
  "새 계정 이메일" 입력란에 이메일을 넣어 로그인한다.
- 시드에 없는 새 이메일을 입력하면 멤버십이 없어 `/onboarding`으로 떨어진다 — 온보딩(매장 생성·초대 합류) 플로우 테스트용.
- 역할별 권한 경계(크루는 본인 데이터만, 마스터만 수락 등)는 CONTEXT.md의 스코프 항목들이 캐논이다.

## 4. 화면 확인·QA 가이드

- **모바일 세로 전용 앱이다.** browse/스크린샷 시 뷰포트를 모바일(권장 390×844)로 잡는다.
  데스크톱 폭으로 보면 레이아웃 판단이 왜곡된다.
- 바텀 탭 4개: 홈 `/` · 출퇴근 `/attendance` · 급여 `/pay` · 마이페이지 `/mypage`. 마스터 대시보드는 `/master`.
- 핵심 플로우 (QA 시나리오의 기본 단위):
  - **출퇴근 등록**: `/attendance` 우하단 FAB이 단일 진입점(홈 카드는 상태 표시 전용). 퇴근은 confirm 다이얼로그를 거친다.
  - **수정요청**: 크루로 요청 생성 → 박점주로 전환 → `/master` 수정요청 컨펌에서 수락 → 레코드 반영 확인.
  - **급여 검산**: `/pay` 월 합계 = Σ 일급(주휴 포함). 산식은 CONTEXT.md 참조.

## 5. 데모 데이터 리셋

`pnpm db:seed` 는 idempotent하지만 **데모 매장의 운영 데이터(출퇴근/스케줄/수정요청 등)를 전부
삭제 후 시드값으로 재삽입**한다. 검증 중이던 수동 입력·재판정 결과가 날아가므로,
사용자가 리셋을 원한 게 확실할 때만 실행한다. 시드가 필요해 보이는 경우(빈 DB 포함)에도
임의로 실행하지 말고, 먼저 운영 데이터 건수를 확인해 그 결과와 함께 사용자 컨펌을 받은 뒤에만 실행한다:

```bash
docker exec ttok-pg psql -U ttok -d ttok -c 'SELECT count(*) FROM "AttendanceRecord";'
```

## 6. 테스트와의 관계

`pnpm test` (vitest)는 전용 DB `ttok_test`(같은 5433 컨테이너, globalSetup이 자동 마이그레이션)를
쓴다. dev DB와 분리되어 있어 dev 데이터에 영향 없이 언제든 돌려도 된다.

## 7. 트러블슈팅

- `prisma.<model> is undefined`: Prisma Client가 stale → dev 서버 재시작(재시작 시 0번 항목의 주의 적용).
- 5433 연결 실패: `docker compose up -d` 후 컨테이너 `ttok-pg` 기동 확인.
- prod 확인이 필요하면 https://ttok-nine.vercel.app — dev 로그인이 차단되므로 구글/카카오 실로그인이 필요하다.
