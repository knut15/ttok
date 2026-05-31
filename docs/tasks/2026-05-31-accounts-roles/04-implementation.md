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

## 청크3 (T8-6, T8-5, T8-8) — 마지막 청크

작성: 2026-06-01 / 범위: 초대 플로우(T8-6) + 마스터 집계뷰(T8-5) + 통합·DoD(T8-8). **T8 전체 완료.**

### AC 충족 매핑

| AC | 구현 위치 | 요약 |
|---|---|---|
| AC-13 (초대 생성) | `src/app/api/invites/route.ts` POST | 마스터 게이트 통과 시 `createInvite(crewId)` → 201 Invite(대기 코드) |
| AC-15 (초대 게이트) | `invites/route.ts` `role!=="master" → 403` | 크루/헤더 부재 → 403 (store 불변) |
| AC-14 (코드 합류) | `src/app/api/invites/join/route.ts` POST | `joinByInvite(code, crewId)` → 200 JoinResult(크루 active=true) |
| E-2/E-2b (합류 실패) | `invites/join/route.ts` | 없는 코드 → 400, 이미 사용 → 409, body 누락 → 400 |
| AC-10/AC-11 (집계) | `src/app/api/master/crews/route.ts` GET | `?month=` → `getCrewSummaries(month)` → MasterSummaryResponse(크루3, 마스터 제외) |
| AC-12 (집계 게이트) | `master/crews/route.ts` `role!=="master" → 403` | 크루/헤더 부재 → 403 |
| T8-6 (초대 UI) | `InvitePanel.tsx` + `useInvites.ts` | role 분기: 마스터=생성 버튼+코드 표시 / 크루=코드 입력+합류. authHeaders 전달. MyPageView 섹션 |
| T8-5 (집계 UI) | `MasterView.tsx` + `CrewSummaryList.tsx` + `useMasterSummary.ts` + `app/master/page.tsx` | RSC 셸 → client 가드(mount 후 role≠master→replace("/"), 미확정 로딩 가드) → 월선택 + 집계행 |
| E-5 (빈 크루) | `CrewSummaryList` / `getCrewSummaries` | 0 graceful 표기(NaN/crash 방어), 크루 0건 빈 상태 |
| E-4 (마스터 빈 기록) | `BottomNav` MASTER_TABS | 마스터 출퇴근/급여 탭 미노출(본인 기록 없음 정상) |
| T8-5 (role 탭) | `BottomNav.tsx` | 크루 4탭 / 마스터 집계+마이페이지 2탭, 하이드레이션 안전(mount 게이트) |
| T8-8 (통합·문서) | `CONTEXT.md` + `docs/adr/0005-accounts-roles-mock.md` | 용어 5개 보강 + ADR 0005(결정 2건) |

### 산출물

| 파일 | 변경 | 내용 |
|---|---|---|
| `src/app/api/invites/route.ts` | 신규 | POST 초대 생성(마스터 게이트 403, 통과 시 createInvite → 201) |
| `src/app/api/invites/join/route.ts` | 신규 | POST 합류(없는코드 400 / 사용됨 409 / body누락 400 / 성공 200) |
| `src/app/api/master/crews/route.ts` | 신규 | GET 집계(마스터 게이트 403, MasterSummaryResponse) |
| `src/features/accounts/hooks/useInvites.ts` | 신규 | 초대 생성/합류 훅(authHeaders, route 경유) |
| `src/features/accounts/hooks/useMasterSummary.ts` | 신규 | 집계 fetch 훅(month/role effect 의존성, active cleanup) |
| `src/features/accounts/components/InvitePanel.tsx` | 신규 | `"use client"` role 분기 초대 패널 |
| `src/features/accounts/components/CrewSummaryList.tsx` | 신규 | presentational 집계 행(빈 상태 graceful) |
| `src/features/accounts/components/MasterView.tsx` | 신규 | `"use client"` 마스터 가드 + 월선택 + 집계뷰 조립 |
| `src/app/master/page.tsx` | 신규 | `/master` RSC 셸 |
| `src/features/mypage/components/MyPageView.tsx` | 수정 | `<InvitePanel/>` 섹션 추가(role별) |
| `src/components/BottomNav.tsx` | 수정 | role별 탭(CREW_TABS/MASTER_TABS), `useSyncExternalStore` mount 게이트 |
| `src/app/api/invites/route.test.ts` | 신규 | 3 테스트(마스터 201 / 크루 403 / 헤더부재 403) |
| `src/app/api/invites/join/route.test.ts` | 신규 | 4 테스트(성공 200 / 없는코드 400 / 사용됨 409 / 누락 400) |
| `src/app/api/master/crews/route.test.ts` | 신규 | 3 테스트(마스터 200 집계 / 크루 403 / 헤더부재 403) |
| `CONTEXT.md` | append | 용어 5개 보강(마스터 집계뷰/크루 집계 행/초대 플로우 API/role별 바텀탭) |
| `docs/adr/0005-accounts-roles-mock.md` | 신규 | ADR 0005: ① crewId 스코프 전략 A+헤더 전달 ② mock 역할전환 신뢰모델(클라 선언+서버 게이트 이중 방어) |

- 컨벤션 적용: leaf 단일출처(`@/types`), client store 직접 import 금지(route 경유), no-store fetch, RSC 셸 + client 가드 경계, append-only.
- 프로젝트 자원: `package.json` scripts(test/lint/build) 직접 호출. 슬래시 commands/skills 등록분 없음(글로벌 default).
- Repository Artifacts: CONTEXT.md 용어 5개 추가(누적 T8 20개), ADR 0005 신규 생성.
- 신규 파일 배치: 계정/역할 도메인은 `src/features/accounts/` (architect §1.1), 라우트는 app-router 규약 경로.

### TDD 사이클 (vertical slice)

| 사이클 | 대상 AC | RED | GREEN |
|---|---|---|---|
| 1 | 초대 생성/합류 API(AC-13/14/15/E-2/E-2b) | `Cannot find module './route'`(invites·join 부재) | invites·join route 작성 → 7/7 |
| 2 | 마스터 집계 API(AC-10/11/12) | `Cannot find module './route'`(master/crews 부재) | master/crews route 작성 → 3/3 |

store 도메인 함수(`getCrewSummaries`/`createInvite`/`joinByInvite`)는 청크1 `store.crews.test.ts`(15건)에서 집계 정확·400/409 흐름 RED→GREEN 완료 → 본 청크는 라우트 통합층 테스트로 게이트(403)·HTTP 상태(400/409/200/201) 검증. UI(MasterView/InvitePanel/CrewSummaryList/BottomNav)는 vitest node 환경 미지원 → 빌드/타입/lint + 코드 일치 검증. Horizontal slicing 미사용(사이클별 RED→GREEN 분리). 내부 협력자 mock 0(route 는 실제 store 경유, 시스템 경계만).

### 회귀 게이트 결과

- **기존 165 테스트: 전부 GREEN. 보정 0줄.** 신규 라우트는 신규 경로/헤더만 추가 → 기존 read/approve 테스트 무영향. BottomNav role 분기는 mount 전 기본 크루 4탭 유지(하이드레이션·기존 UI 회귀 0).
- 전체: **175 passed** (165 + 신규 10: invites 3 + invites/join 4 + master/crews 3).

### 자가 검증 (DoD 4종, 직접 Bash)

- 단위 테스트: ✅ `pnpm test` → 21 files / **175 passed** (165 + 10 신규, 회귀 0)
- 타입체크: ✅ `npx tsc --noEmit` → exit 0
- Lint: ✅ `pnpm lint` → 0 error / 0 warning (useMasterSummary 는 set-state-in-effect 회피 위해 effect 내 동기 setLoading 제거, usePay 패턴 정렬)
- 빌드: ✅ `pnpm build` → 성공. 신규 라우트 생성 확인: `ƒ /api/invites`·`ƒ /api/invites/join`·`ƒ /api/master/crews`(dynamic), `○ /master`(static 셸). 기존 라우트 전부 유지.

### 경계면 일치 확인

- API ↔ Frontend: `useInvites` POST `/api/invites`·`/api/invites/join`(authHeaders) ↔ route `readScope`/`joinByInvite` 계약 일치. `useMasterSummary` GET `/api/master/crews?month=` ↔ route `MasterSummaryResponse{month, crews}` shape 일치.
- 권한 게이트(3중 일관): approve(청크2) + invites + master/crews 모두 `readScope(req).role!=="master" → 403` 동일 패턴. UI(InvitePanel role 분기 / BottomNav MASTER_TABS / MasterView 가드) + API 403 이중 방어.
- 하이드레이션: MasterView·BottomNav 모두 `useSyncExternalStore` mount 게이트 → SSR/첫CSR 은 크루 기본(role 미확정) 마크업, mount 후 역할 복원 시점에만 마스터 분기. mismatch 0, 섣부른 리다이렉트 0.
- 전환 무효화: useMasterSummary effect 의존성에 `crewId`/`user.role` 추가 → 전환 시 재fetch, active cleanup 으로 stale 차단.

## 전체 T8 완료 요약 (청크1+2+3)

- **범위 완료**: T8-1(타입+멀티크루 시드) · T8-2(store recordsByCrew) · T8-3(CurrentUserProvider+scope+역할전환) · T8-4(기존 API/hooks 스코프) · T8-7(수락 마스터 게이트) · T8-6(초대 플로우) · T8-5(마스터 집계뷰) · T8-8(통합·문서). 8개 sub-task 전부 구현.
- **테스트**: 최종 **175 passed** (기존 138 + T8 신규 37: seed.crews 6 + store.crews 15 + scope 4 + approve 신규 2 + invites 3 + invites/join 4 + master/crews 3). 기존 138 테스트 무수정 GREEN(회귀 0) — approve.test.ts 만 수락=마스터 액션 계약 반영해 헤더 부여(테스트 코드 한정).
- **DoD 전부 GREEN**: `pnpm test`(175) / `tsc --noEmit`(exit 0) / `pnpm lint`(0/0) / `pnpm build`(신규 라우트 `/api/invites`·`/api/invites/join`·`/api/master/crews`·`/master`·`/api/crews` 생성).
- **전체 흐름**: 역할전환(RoleSwitcher) → 크루 본인 스코프 강제(enforceReadScope) → 마스터 집계(/master) → 초대 발급(POST /api/invites) → 수락 게이트(role≠master 403) 일관 동작. 회귀 0 = 헤더 전달(URL 불변) + trailing crewId fallback(김민정) + buildSeedRecords() 불변.
- **Repository Artifacts**: CONTEXT.md 누적 20개 T8 용어, ADR 0005 신규(crewId 스코프 전략 A+헤더 / mock 역할전환 신뢰모델).

## REWORK v2 (분류 A — 차단 P1 2건)

> task-developer / 2026-06-01 / mode: teammate. 리뷰 05-review.md P1-2·P1-3 한정 수정(범위 한정, 회귀 금지). 회차: rework v2.

### AC 충족 매핑

- **AC-11 (P1-2) 마스터 드릴다운 경로** → `CrewSummaryList.tsx:24-50`(각 집계행을 `/master/[crewId]` Link 로) + `src/app/master/[crewId]/page.tsx`(신규 RSC 셸) + `MasterCrewDetail.tsx`(신규 client: 마스터 mount-gate 가드 + 월선택 + 대상 크루 월간 근무/휴일 일자목록) + `useAttendance.ts:16-67`(`useMonthAttendance(month, targetCrewId?)` 최소 확장 — targetCrewId 제공 시 `?crewId=` 부착). 백엔드 무변경: 기존 `/api/attendance` GET 이 `enforceReadScope`(scope.ts) 로 마스터의 requested crewId 를 이미 허용.
- **E-3 (P1-3) 전환 시 stale 즉시 초기화** → `useAttendance.ts`(useMonthAttendance:41 `setRecords([])`+`setLoading(true)` / useDayAttendance:82 `setRecord(null)`+`setLoading(true)` / useEditRequests:133 `setRequests([])`) + `usePay.ts`(useMonthPay:22 / useDayPay:50 `setData|setDetail(null)`+`setLoading(true)`) + `useProfile.ts:27`(`setData(null)`+`setLoading(true)`). 전환(crewId effect 재실행) 직후 이전 사용자 데이터 즉시 리셋 후 fetch. 기존 `active` cleanup 유지(이중 방어).

### TDD 사이클

| 사이클 | AC | RED | GREEN |
|---|---|---|---|
| 1 | AC-11 (drilldown 계약) | `attendance/route.test.ts` 마스터 `?crewId=crew-2` → crew-2 의 2026-05-09(김민정 부재) 반환 + 크루는 `?crewId` 무시(본인 강제) 2건 작성 → FAIL(초기 discriminator 오류로 RED 확인) | discriminator 를 crew-2 고유일(05-09)로 교정 → 2 PASS (백엔드 enforceReadScope 가 이미 마스터 requested 허용 → UI 경로만 추가) |
| 2 | E-3 (stale 리셋) | vitest node 환경상 훅 렌더 단위테스트 미지원 → 코드 일치 + DoD(build/tsc/lint) 로 검증(task 지침) | 5개 훅 effect 시작부 동기 리셋(`set-state-in-effect` 의도적, eslint-disable 명시) |

- Horizontal slicing 여부: ❌ (사이클별 vertical slice). 내부 협력자 mock 0.

### 산출물

| 항목 | 내용 |
|---|---|
| 신규 파일 | `src/app/master/[crewId]/page.tsx`(RSC 셸), `src/features/accounts/components/MasterCrewDetail.tsx`(client 마스터 가드 + 일자목록) |
| 수정 파일 | `CrewSummaryList.tsx`(행→Link), `useAttendance.ts`(targetCrewId 확장 + 3훅 stale 리셋), `usePay.ts`(2훅 리셋), `useProfile.ts`(1훅 리셋) |
| 추가 테스트 | `attendance/route.test.ts` +2 (마스터 드릴다운 / 크루 격리) |
| 프로젝트 자원 | 기존 `enforceReadScope`(scope.ts 마스터 requested 허용) 재사용 — 백엔드 무변경. `longWorkLabel`/`statusTone`/`formatDotDate`/`weekdayKo` 등 기존 도메인 헬퍼 재사용 |
| 컨벤션 적용 | `"use client"` 경계, leaf 단일출처(`@/types`), no-store fetch, mount-gate 하이드레이션(MasterView 동일 패턴), 변경 파일 한정 lint |

### 자가 검증 (DoD)

- 빌드: ✅ `pnpm build` → 성공, `ƒ /master/[crewId]` dynamic 라우트 생성 확인.
- 타입체크: ✅ `npx tsc --noEmit` → exit 0.
- 단위 테스트: ✅ `pnpm test` → 21 files / **177 passed** (기존 175 + 신규 2, 회귀 0).
- Lint: ✅ `pnpm lint` → 0 error / 0 warning.

### 경계면 일치 확인

- API ↔ Frontend: `useMonthAttendance(month, crewId)` → GET `/api/attendance?month=&crewId=`(authHeaders master) ↔ route `enforceReadScope(readScope(req), requested)` 마스터 requested 허용. 크루는 서버에서 무시(본인 강제) → UI 가드(router.replace)와 이중.
- 권한 경계: `/master/[crewId]` 접근 시 MasterCrewDetail mount-gate 가드(role≠master → `router.replace("/")`), 데이터 격리는 서버 enforceReadScope 가 최종 강제(클라 가드 우회해도 크루 헤더면 본인 데이터만).
- 전환 stale: 5개 데이터 훅 모두 crewId effect 재실행 시 동기 리셋(data=null/empty + loading=true) → 이전 사용자 데이터 노출 0. active cleanup 으로 race 차단 유지.

### 범위 준수

- P1-1(crew-2/3 주휴수당) · P1-4(active 시드) follow-up 미손댐. 그 외 변경 0. 기존 175 테스트 무수정 GREEN.
