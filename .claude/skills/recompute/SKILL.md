---
name: recompute
description: >
  근태 판정·급여 계산 규칙(지각/조퇴/연장/대타/휴게/차감 등)이 바뀔 때 기존 DB 레코드를
  새 규칙으로 재판정(backfill)하는 절차. AttendanceRecord 등에는 판정 결과가 기록 시점
  값으로 캐시되어 있어, 코드만 고치면 과거 데이터가 옛 규칙으로 남아 화면·급여가 어긋난다.
  src/lib의 판정·산식 로직을 변경하는 작업, 컬럼의 의미가 바뀌는 마이그레이션,
  "기존 데이터도 새 규칙에 맞춰야 하는" 모든 작업에서 이 스킬로 재판정 필요 여부를
  판단하고 dev→prod 순서로 실행하라.
---

# recompute — 판정 규칙 변경 시 DB 재판정

## 왜 필요한가

이 앱은 판정·산식 결과를 레코드에 **기록 시점 값으로 캐시**한다
(`AttendanceRecord.status / clockInStatus / clockOutStatus / workMinutes / overtimeMinutes / breakMinutes / deductMinutes` 등).
규칙을 바꾸면 새 기록부터만 새 규칙이 적용되고, 과거 레코드는 옛 규칙으로 남는다.
달력·급여·대시보드가 과거 레코드를 그대로 읽으므로, 재판정 없이는 화면과 급여가 어긋난다.

선례: "예정 근무시간 기준 근태 자동판정" 도입(커밋 30d91ce) 때 `scripts/recompute.ts`로
dev·prod 전 레코드를 재판정하고 대타를 스케줄표에 동기화했다.

## 1. 재판정 필요 여부 판단

규칙 변경 PR마다 다음을 점검한다. 하나라도 해당하면 재판정 스크립트가 필요하다:

- 위 캐시 컬럼들의 **계산식이나 의미**가 바뀌는가?
- 파생 데이터 동기화에 영향이 있는가? (예: 대타 판정 → `ScheduleEntry.substitute` upsert)
- 마이그레이션으로 컬럼이 추가되어 기존 행에 채워야 할 값이 생기는가?

해당 없음(예: UI만 변경, 새 기록에만 적용되는 정책)이면 여기서 끝— 판단 근거를 한 줄 남긴다.

## 2. 스크립트 작성

`scripts/recompute.ts` 를 템플릿으로 새 스크립트를 만든다(`scripts/recompute-<주제>.ts`)
또는 같은 규칙의 재실행이면 기존 파일을 개정한다. 요건:

- **idempotent** — 두 번 실행해도 결과가 같아야 한다(prod 재실행 사고 방지).
- 파일 머리에 목적·판정 규칙 요약·실행 커맨드를 주석으로 남긴다(다음 규칙 변경의 템플릿이 된다).
- 도메인 규칙은 CONTEXT.md와 일치시킨다 — 예정 근무시간은 `ScheduleEntry` 우선 → `FixedShift` 폴백,
  법정 휴게(4h 미만 0 / 8h 미만 30 / 이상 60), 휴가·결근·clockIn 없는 레코드 제외 등.
  앱 코드의 순수 함수(`src/lib/attendance-rules.ts`, `time.ts`)를 재사용할 수 있으면 복붙 대신 import 한다.
- 마지막에 처리 건수를 출력한다(`재판정 N건 · 동기화 M건`) — 전후 비교의 근거.
- 스크립트는 **레포에 커밋**한다(1회용이어도 — 이력과 템플릿 가치).

## 3. dev 실행 → 검증

```bash
npx tsx scripts/recompute-<주제>.ts    # .env의 로컬 DB(localhost:5433)를 자동으로 읽는다
```

검증: `pnpm test` 통과 + 앱 화면(달력·급여·대시보드)에서 영향받는 샘플 날짜를 직접 확인한다
(기동·페르소나는 **dev-run 스킬** 참조). 시드 기대값이 바뀌었다면 시드·테스트도 같은 PR에서 갱신한다.

## 4. prod 실행 (사용자 승인 필수)

prod 데이터를 직접 변경하므로 **건수·대상을 보고하고 사용자 승인을 받은 뒤** 실행한다.

```bash
# Vercel → Settings → Environment Variables 에서 DATABASE_URL_UNPOOLED 값을 복사해 사용
DATABASE_URL="<prod DATABASE_URL_UNPOOLED>" \
DATABASE_URL_UNPOOLED="<prod DATABASE_URL_UNPOOLED>" \
npx tsx scripts/recompute-<주제>.ts
```

- **직결(unpooled) URL을 쓴다** — 풀러(pgbouncer) 경유는 대량 업데이트·prepared statement에 부적합.
- 코드 배포(main push → Vercel)와 재판정 실행의 **순서**를 생각한다: 새 코드가 옛 데이터를 읽어도
  안전하면 배포 → 재판정, 아니면 재판정 → 배포. 판단이 애매하면 사용자와 상의.
- 실행 후 prod 화면(https://ttok-nine.vercel.app)에서 샘플을 확인하고, 출력된 건수를 보고한다.
- 되돌리기 어려운 변경이 불안하면 실행 전 Neon 콘솔에서 브랜치(스냅샷)를 떠 둘 수 있다.
