# 04-implementation — 구현 노트 (T8: 계정/권한 분리)

> task-developer / mode: teammate (Notion 미사용) / 청크 단위 이어쓰기

## 청크1 (T8-1, T8-2)

작성: 2026-06-01 / 범위: 타입 + 멀티크루 시드(T8-1) + store recordsByCrew 리팩토링(T8-2). **T8-3~8 미착수.**

### AC 충족 매핑

| AC | 구현 위치 | 요약 |
|---|---|---|
| AC-1 | `src/lib/seed.ts` `buildSeedCrews()` / `src/lib/store.ts` `listCrews()` | 마스터1(`master-1`) + 크루3(`crew-minjung`/`crew-2`/`crew-3`) = 4 계정 |
| AC-2 | `src/lib/seed.ts` `buildSeedRecordsByCrew()` / `store.ts` `getMonthRecords(month)` | 김민정 Map = 기존 `buildSeedRecords()` 재사용(바이트 동일). 시드 불변식 ①440 ②6회·544 ③totalPay ④5-28(392/67424) ⑤휴게범위 보존 |
| AC-3 | `seed.ts` `CREW_2_ROWS`/`CREW_3_ROWS` + `rowsToMap()` | 크루2/3 별도 mock(다른 데이터), 김민정과 물리 분리 → 격리 |
| AC-10/AC-11 | `store.ts` `getCrewSummaries(month)` | 크루별 workMinutes/overtimeMinutes/vacationDays 집계(마스터 제외) |
| AC-13 | `store.ts` `createInvite(masterId)` | 대기 상태 고유 코드 발급 |
| AC-14 | `store.ts` `joinByInvite(code, crewId)` | 유효 미사용 → active=true + JoinResult |
| E-2/E-2b | `store.ts` `joinByInvite` | 없는 코드 → null(400 의미), 사용된 코드 → "used"(409 의미) |
| E-5/E-6 | `getCrewSummaries`/`getMonthRecords` | 빈 크루·없는 월 → 0/[] (NaN·crash 방어) |
| AC-R1 | 전체 | 기존 138 테스트 **무수정 GREEN** (보정 0줄) |
| AC-R2 | 9개 store 함수 trailing `crewId=DEFAULT_CREW_ID` fallback | 인자 생략 → 김민정 |
| AC-R3/R4/R5 | `buildSeedRecords()` 불변 + private 헬퍼(`recalcClockFields`/`emptyRecord`/`newRecordFrom`) 로직 불변 | 시드 불변식·연장 산식·휴게 범위·approve 정책 보존 |

### 산출물

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/types/index.ts` | append | `Role`/`Crew`/`User`/`InviteStatus`/`Invite`/`CrewSummary`/`MasterSummaryResponse`/`JoinResult` 신규 + `AttendanceRecord`·`EditRequest`에 `crewId?` |
| `src/lib/constants.ts` | append | `DEFAULT_CREW_ID`/`MASTER_ID`/`CREW_IDS`/`HEADER_CREW_ID`/`HEADER_ROLE`/`INVITE_CODE_ALPHABET`/`INVITE_CODE_LENGTH` |
| `src/lib/seed.ts` | append | `buildSeedCrews`/`buildSeedRecordsByCrew`/`buildSeedInvites` + `rowsToMap`. 기존 `buildSeedRecords()` 시그니처·반환 **불변** |
| `src/lib/store.ts` | refactor | `StoreShape` → `crews`/`recordsByCrew`/`requests`(crewId 태그)/`invites`/`profilesByCrew`/`storeInfo`/`seq`. 9함수 trailing crewId + fallback. 신규 `listCrews`/`getCrewSummaries`/`createInvite`/`joinByInvite`/`isMaster`. `__resetStore` 전체 리셋 |
| `src/lib/seed.crews.test.ts` | 신규 | 6 테스트 (AC-1/2/3) |
| `src/lib/store.crews.test.ts` | 신규 | 15 테스트 (AC-1/2/3/10/11/13/14, E-2/E-2b/E-5) |
| `CONTEXT.md` | append | 용어 5개 추가(마스터/크루/crewId 스코프/초대/크루 집계) |

- 컨벤션 적용: leaf 타입 단일출처(`@/types`), store server-only 싱글톤·globalThis 가드 보존, append-only 시그니처(ADR 0004 선례).
- ADR 0005: PRD §10.2상 architect phase 산출물 → 본 청크 미작성(통합 청크/architect 회귀 시 작성 예정).

### TDD 사이클 (vertical slice)

| 사이클 | 대상 | RED | GREEN |
|---|---|---|---|
| 1 | seed 멀티크루(AC-1/2/3) | `buildSeedCrews is not a function` | `seed.crews.test.ts` 6/6 |
| 2 | store 멀티크루 스코프 + 신규함수 | 13 fail / 2 pass(회귀체크 선통과) | `store.crews.test.ts` 15/15 |

타입(types/constants)은 런타임 behavior 없는 선언 → seed/store 사이클의 컴파일·행위 검증으로 동반 확인. Horizontal slicing 미사용(사이클별 RED→GREEN 분리).

### 회귀 게이트 결과 (핵심)

- **기존 138 테스트: 전부 GREEN. 보정 0줄.** (설계 §2.7 증명대로 — store 내부필드 직접접근 테스트 0건, 헤더·crewId 인자 생략 → 김민정 fallback, `buildSeedRecords()` 불변.)
- 전체: **159 passed** (138 기존 + 21 신규: seed.crews 6 + store.crews 15).
- 보정 사유: 없음. 단, `joinByInvite` 반환형이 `JoinResult | null | "used"` 유니온이라 신규 테스트에서 TS 내로잉용 guard 1줄 추가(테스트 코드 한정, 기존 테스트 무관).

### 자가 검증 (DoD 4종, 직접 Bash)

- 단위 테스트: ✅ `pnpm test` → 17 files / **159 passed** (회귀 0)
- 타입체크: ✅ `npx tsc --noEmit` → exit 0
- Lint: ✅ `pnpm lint` → 0 error / 0 warning
- 빌드: ✅ `pnpm build` → 성공(라우트 셋 기존 동일, UI 미변경)

### 경계면 일치 확인

- types ↔ store ↔ seed: `Crew`/`Invite`/`CrewSummary`/`JoinResult` 단일출처(`@/types`), store가 그대로 반환.
- store 내부표현 ↔ 기존 계약: `recordsByCrew.get(DEFAULT_CREW_ID)` 가 기존 `records`와 동일 데이터 → 9함수 계약 동등(반환 shape 불변).
- T8-3~8 인계: `HEADER_CREW_ID`/`HEADER_ROLE` 상수, `JoinResultOrError` export, `isMaster`/`listCrews` 준비 완료 (scope.ts·route는 다음 청크).
