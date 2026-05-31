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

## 청크2 (T8-3, T8-4, T8-7)

작성: 2026-06-01 / 범위: 현재 사용자 컨텍스트+scope+역할전환(T8-3) + 기존 API/hooks 스코프 적용(T8-4) + 수락 마스터 게이트(T8-7). **T8-5/6/8 미착수.**

### AC 충족 매핑

| AC | 구현 위치 | 요약 |
|---|---|---|
| AC-8 (본인 강제 스코프) | `src/lib/scope.ts` `enforceReadScope` + API GET/PATCH | 크루는 requested 무시·본인 crewId 강제(403 아님), 마스터는 requested(쿼리 `?crewId=`/헤더) 허용·없으면 self |
| AC-9 (요청 본인 태그) | `attendance/requests/route.ts` POST `crewId: readScope(req).crewId` | 수정요청은 항상 생성자 본인 crewId 태그(헤더 없으면 김민정) |
| AC-18 (수락 게이트) | `attendance/requests/approve/route.ts` `readScope(req).role!=="master" → 403` + `EditRequestList.canApprove` | role≠master → 403 + store 불변(approveRequest 미호출), UI 수락버튼 숨김(이중 방어) |
| AC-19 (마스터 수락) | approve route 마스터 경로 | x-role:master → 기존 approveRequest 동작 보존 |
| T8-3 (현재 사용자) | `CurrentUserProvider`/`useCurrentUser`/`authHeaders`/`RoleSwitcher`/`api/crews` | 초기 state 김민정(하이드레이션 mismatch 0), localStorage mount-gate, 역할전환 → setCurrentUser |
| T8-4 (헤더 전달) | `scope.ts` `readScope` + 6개 route + 3개 hooks | 헤더 `x-crew-id`/`x-role` 추출·전달(URL 불변), crewId effect 의존성 추가(전환 무효화) |
| 회귀 0 | 헤더 부재 fallback(role=crew, crewId=DEFAULT) | 기존 read API 테스트 무영향 |

### 산출물

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/lib/scope.ts` | 신규 | `readScope(req)`(헤더 추출, 폴백 crew/DEFAULT) + `enforceReadScope(scope, requested?)`(크루 본인강제·마스터 requested). 순수, store 비의존 |
| `src/lib/scope.test.ts` | 신규 | 4 테스트(readScope 헤더있음/없음, enforceReadScope 크루강제/마스터requested) |
| `src/features/accounts/context/CurrentUserProvider.tsx` | 신규 | `"use client"` Context, 초기 김민정, localStorage mount-gate(useEffect만), `setCurrentUser` state+localStorage 갱신 |
| `src/features/accounts/hooks/useCurrentUser.ts` | 신규 | Context 소비 훅(Provider 밖 김민정 가드) + `authHeaders(user)` → {x-crew-id, x-role} |
| `src/features/accounts/components/RoleSwitcher.tsx` | 신규 | `/api/crews` fetch → 계정 목록 → 선택 시 `setCurrentUser`(client는 route 경유) |
| `src/app/api/crews/route.ts` | 신규 | GET `listCrews()` → Crew[] |
| `src/app/layout.tsx` | 수정 | `<CurrentUserProvider>` 로 children 래핑(Provider 래핑만, RSC 경계 유지) |
| `src/features/mypage/components/MyPageView.tsx` | 수정 | RoleSwitcher 섹션 + 마스터일 때 `/master` 진입 링크(링크만) |
| `src/app/api/attendance/route.ts` | 수정 | GET/PATCH `enforceReadScope` → store crewId 전달 |
| `src/app/api/attendance/[date]/route.ts` | 수정 | GET `getRecord(date, scoped)` |
| `src/app/api/attendance/requests/route.ts` | 수정 | GET 스코프(마스터 전체/크루 본인), POST 본인 crewId 태그 |
| `src/app/api/pay/route.ts`·`pay/[date]/route.ts` | 수정 | `getMonthRecords`/`getRecord` scoped crewId |
| `src/app/api/profile/route.ts` | 수정 | GET/PATCH `getProfile`/`updateProfile` scoped crewId(헤더 없으면 김민정) |
| `src/app/api/attendance/requests/approve/route.ts` | 수정 | **마스터 게이트** role≠master → 403 + store 불변 |
| `src/app/api/attendance/requests/approve/route.test.ts` | 수정 | 기존 4 검증경로에 `x-role:master` 헤더 부여(수락=마스터 액션 계약 반영) + 신규 2(크루 403·store불변 / 마스터 200·반영) |
| `src/features/attendance/hooks/useAttendance.ts` | 수정 | 3훅 authHeaders + crewId effect 의존성(active cleanup 재활용) |
| `src/features/pay/hooks/usePay.ts`·`mypage/hooks/useProfile.ts` | 수정 | authHeaders + crewId effect 의존성 |
| `src/features/attendance/components/EditRequestList.tsx` | 수정 | `canApprove` prop(기본 false), 수락버튼 조건 `대기 && canApprove && onApprove` |
| `src/features/attendance/components/AttendanceDetail.tsx` | 수정 | `useCurrentUser` role → `canApprove={role==="master"}` 전달, approve는 훅 authHeaders 경유 |
| `CONTEXT.md` | append | 용어 5개 추가(현재 사용자 전달/읽기 스코프 강제/수락 마스터 게이트/현재 사용자 컨텍스트/역할전환) |

- 컨벤션 적용: leaf 단일출처(`@/types`), client store 직접 import 금지(route 경유), append-only 시그니처, no-store fetch 유지.
- ADR: §10.2 ADR 0005 는 통합 청크(T8-8)에서 작성 예정(architect 권장 순서).

### TDD 사이클 (vertical slice)

| 사이클 | 대상 AC | RED | GREEN |
|---|---|---|---|
| 1 | scope.ts(AC-8 강제로직) | `readScope is not a function`(모듈 부재) | `scope.test.ts` 4/4 |
| 2 | approve 마스터 게이트(AC-18/19) | 크루 헤더 → `expected 403, got 200` | route 게이트 추가 → 6/6 |

T8-4 route/hook 스코프 배선과 T8-3 UI(Provider/RoleSwitcher/canApprove)는 vitest node 환경 미지원(UI) → 빌드/타입/lint + 기존 회귀 테스트(헤더 부재 fallback)로 행위 검증. Horizontal slicing 미사용(사이클별 RED→GREEN 분리). 내부 협력자 mock 0(scope.ts 순수, route는 실제 store 경유).

### 회귀 게이트 결과

- **기존 159 테스트: 전부 GREEN.** read API(attendance/pay/profile/requests GET) 테스트는 헤더 부재 → `role=crew`/`crewId=DEFAULT_CREW_ID` fallback → 김민정 스코프(기존과 동일).
- approve route.test.ts 4건은 **수락이 마스터 전용 액션으로 계약이 바뀌어** `x-role:master` 헤더 부여(테스트 코드 한정). store/seed/pay 불변식 테스트는 무수정.
- 전체: **165 passed** (159 + 신규 6: scope 4 + approve 2).

### 자가 검증 (DoD 4종, 직접 Bash)

- 단위 테스트: ✅ `pnpm test` → 18 files / **165 passed** (159 + 6 신규, 회귀 0)
- 타입체크: ✅ `npx tsc --noEmit` → exit 0
- Lint: ✅ `pnpm lint` → 0 error / 0 warning (CurrentUserProvider mount-gate setState 는 외부시스템 1회 동기화로 규칙 예외 명시 disable)
- 빌드: ✅ `pnpm build` → 성공, `/api/crews` 라우트 추가, 기존 페이지 셋 동일

### 경계면 일치 확인

- API ↔ Frontend(헤더 계약): client `authHeaders(user)` → `{x-crew-id, x-role}` == server `readScope` 추출키(`HEADER_CREW_ID`/`HEADER_ROLE`). 헤더 부재 양측 김민정 fallback 일치.
- 하이드레이션: `CurrentUserProvider` 초기 state 김민정(서버/CSR 1차 동일), localStorage mount-gate → SSR 마크업과 1차 CSR 렌더 동일(mismatch 0).
- 권한 게이트: approve API 403(role≠master) + `EditRequestList.canApprove` UI 숨김 이중. `AttendanceDetail`이 `role==="master"` 전달.
- 전환 무효화: 데이터 훅 effect 의존성에 `crewId` 추가 → 역할전환 시 재fetch, 기존 `active` cleanup 으로 stale 응답 차단.
- T8-5/6/8 인계: scope/헤더/Provider/authHeaders 준비 완료. `/master` 화면·`api/master/crews`·`api/invites`·InvitePanel·BottomNav role 분기·ADR 0005 는 다음 청크.
