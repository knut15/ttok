# ADR 0009 — 운영 데이터 Prisma 완전 이관(인메모리 store 제거)

Date: 2026-06-01
Status: Accepted

## Context

ADR 0008까지 신원(User·Store·Membership·Invite)은 Prisma, 운영 데이터(출퇴근·수정요청·스케줄·고정근무·알림·프로필·매장정보)는 인메모리 store(`src/lib/store.ts`, globalThis 싱글톤)로 이원화돼 있었다. 이 때문에:
- 실매장/실멤버가 **실제 근태·스케줄을 기록·영속화하지 못함**(인메모리는 데모 crew에만 묶이고 재시작 시 휘발).
- 마스터 화면에 데모 데이터가 누수되는 버그가 반복(전역 인메모리 상태의 증상).

사용자 결정: **완전 이관** — 인메모리 store 제거, 모든 운영 데이터를 Prisma/Postgres 단일 진실원으로.

## Decision

### ① 단일 진실원 = Prisma. 인메모리 store 제거
- 운영 모델 추가: `AttendanceRecord·EditRequest·ScheduleEntry·FixedShift·Notification·Profile`(+ Store에 운영 표시필드). 모든 운영 행은 `storeId + crewId` 보유.
- `crewId = operationalId(데모) ?? membershipId(실멤버)`로 통일(`resolveScope`/`storeIdForCrew`). per-crew 쿼리는 crewId(전역 유일) 키, store-wide 쿼리는 storeId 스코프.
- 도메인 계층 분리: `attendance-store`(출퇴근/수정요청/집계), `schedule-store`(스케줄/고정/알림/대타), `profile-store`(프로필/매장). 권한·매장해석은 `identity-repo`(`canWriteSchedule`/`resolveStoreId`/`storeIdForCrew`/`listStoreCrews`/`setMembershipManager`).
- `src/lib/store.ts`는 **배럴(re-export)**만 남김 — 라우트/테스트의 기존 `@/lib/store` import 경로 보존. globalThis 싱글톤·`__resetStore`·레거시 인메모리 invite 제거.

### ② 순수 도메인 규칙 보존(고속 단위테스트)
- 계산/정책은 DB 비의존 순수 모듈로 추출·재사용: `attendance-rules`(상태정책·재계산·승인반영), `schedule-view`(명시+고정 병합·대타판정), 기존 `time/pay/date`. 불변식(차감 440·연장 544·주휴 67,080) 보존.

### ③ 실 멤버 운영 가능
- 스케줄/고정근무 배정 대상 crewId 를 **요청자 매장의 실제 멤버**(Prisma)로 검증 → 실 매장의 실 멤버에게 배정·기록·영속.
- `/api/crews`·집계·대타·수정요청·매니저 토글 모두 매장 멤버십(Prisma) 기반으로 스코프(데모 데이터 누수 차단).

### ④ 테스트 = Docker Postgres 테스트DB
- ADR P0의 하니스 계승: vitest `globalSetup`(migrate deploy) + 테스트DB env + 직렬 실행. `__resetStore` → `resetDb`(per-test truncate+reseed, `db-seed`).
- 순수 도메인 테스트(time/pay/date/domain)는 DB 비의존 유지.

## Consequences
- 출퇴근·급여·스케줄·고정근무·알림·프로필이 **Postgres에 영속**(재시작 후 유지 검증). 실매장 마스터가 실 멤버에게 스케줄 배정→DB 저장 확인.
- 308 테스트 GREEN(테스트DB), lint·build 통과. 인메모리 전역 상태 제거로 "목 데이터 누수" 류 버그 구조적 해소.
- (−) 테스트가 Postgres에 의존(직렬 실행으로 느려짐 ~10s). dev 로컬은 `docker compose up -d` 필요.
- (−) 데모 시드는 운영 데이터를 Prisma에 적재(`db-seed`) — 기존 순수 builder 재사용으로 값 동일성 보존.

## Alternatives Considered
- **이중 경로(실매장 Prisma + 데모 인메모리 유지)**: 회귀 0이나 운영 로직 이중 구현·기술부채. 단일 진실원 채택.
- **테스트를 mock/in-memory repo 로**: 도메인 로직 이중화 위험. 실 Postgres 통합 테스트 채택(순수 규칙은 별도 단위테스트로 고속 보존).
- **운영 데이터까지 일괄 빅뱅 이관**: 장기 red 위험. 도메인별 단계(P1 출퇴근→P2 스케줄→P3 프로필+제거)로 각 단계 GREEN 커밋.

## 관련
- ADR 0008(신원 Prisma), `src/lib/{attendance,schedule,profile}-store.ts`, `src/lib/{attendance-rules,schedule-view,db-seed}.ts`, `vitest.config.ts`
