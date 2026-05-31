# 05-review — 리뷰 보고서 (v1)

> task-reviewer / 2026-06-01 / mode: teammate (Notion 미사용)
> 대상: T8 계정/권한 분리 (마스터·크루) — 최신 커밋 1e295a1, base 70eeb16

---

## AC 매트릭스

### FR-1 mock 계정 + 멀티 크루 시드

| AC# | 내용 | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| AC-1 | 마스터 1 + 크루 3 존재 | `src/lib/seed.ts:122-129` `buildSeedCrews()` 4계정 반환. `store.crews.test.ts > listCrews > 마스터 1 + 크루 3 = 4 계정` | ✅ | file:line |
| AC-2 | 김민정 5월 레코드 = 기존 단일사용자 시드와 동일 | `src/lib/seed.ts:172-176` `buildSeedRecordsByCrew()` 내 `buildSeedRecords()` 재사용. `seed.crews.test.ts > buildSeedRecordsByCrew > 김민정 records는 기존 buildSeedRecords()와 바이트 동일 (AC-2)` | ✅ | file:line |
| AC-3 | crew-2/3 = 김민정과 다른 본인 근무기록 | `src/lib/seed.ts:131-165` `CREW_2_ROWS`/`CREW_3_ROWS` + `rowsToMap`. `seed.crews.test.ts > 크루2/크루3도 records Map을 가진다 (AC-3)` | ✅ | file:line |

### FR-2 현재 사용자 / 역할 컨텍스트 + 전환

| AC# | 내용 | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| AC-4 | 기본 현재 사용자 = 김민정(crew) | `src/features/accounts/context/CurrentUserProvider.tsx:17-23` `INITIAL_USER = { id: DEFAULT_CREW_ID, role: "crew" }` | ✅ | file:line |
| AC-5 | 마스터 선택 시 현재 사용자/역할 → master + localStorage 반영 | `src/features/accounts/context/CurrentUserProvider.tsx:52-58` `setCurrentUser`: state+localStorage 갱신. `src/features/accounts/components/RoleSwitcher.tsx:46` `setCurrentUser(crewToUser(crew))` | ✅ | file:line |
| AC-6 | 새로고침 시 localStorage 복원 | `src/features/accounts/context/CurrentUserProvider.tsx:42-49` mount 후 `useEffect`에서 localStorage 읽기 | ✅ | file:line |

### FR-3 크루 본인-스코프

| AC# | 내용 | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| AC-7 | 크루A 화면 = 크루A 데이터만 | `src/features/attendance/hooks/useAttendance.ts:25-37` `src/features/pay/hooks/usePay.ts` `authHeaders(user)` + `enforceReadScope` API 강제 경로 | ✅ | file:line |
| AC-8 (권한 경계) | 크루A가 타 crewId 요청 시 → 크루A 데이터만 반환 | `src/lib/scope.ts:26-28` `enforceReadScope`: 크루는 requested 무시·본인 강제. `scope.test.ts > 크루는 requested를 무시하고 본인 crewId를 강제한다` | ✅ | file:line |
| AC-9 | 요청 생성 시 생성자 crewId 태그 | `src/app/api/attendance/requests/route.ts:95-100` `addRequest({ ..., crewId: readScope(req).crewId })` | ✅ | file:line |

### FR-4 마스터 집계 뷰

| AC# | 내용 | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| AC-10 | 마스터 집계뷰 = 전체 크루 3명 + 근무/휴일 요약 | `src/app/api/master/crews/route.ts:11-25` `getCrewSummaries(month)`. `master/crews/route.test.ts > 마스터는 200과 MasterSummaryResponse(크루 3명 집계)를 반환한다` | ✅ | file:line |
| AC-11 | 특정 크루 선택 → 해당 크루 상세(읽기) | `src/app/api/master/crews/route.ts:20` `getCrewSummaries` 반환 shape에 crewId 포함. `store.crews.test.ts > getCrewSummaries > 크루 3명의 근무/연장/휴가 요약을 반환한다(마스터 제외)` | ✅ | file:line |
| AC-12 (권한 경계) | 크루가 /api/master/crews → 403 | `src/app/api/master/crews/route.ts:13-17` `role !== "master" → 403`. `master/crews/route.test.ts > 크루 역할은 집계 조회 시 403을 반환한다` | ✅ | file:line |

### FR-5 초대 플로우

| AC# | 내용 | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| AC-13 | 마스터 초대 생성 → Invite(status="대기") + 코드 표시 | `src/app/api/invites/route.ts:10-19` 마스터 → `createInvite(scope.crewId)` → 201 Invite. `invites/route.test.ts > 마스터는 201과 대기 상태의 초대 코드를 발급받는다` | ✅ | file:line |
| AC-14 | 유효 미사용 코드 합류 → active=true + 200 | `src/app/api/invites/join/route.ts:18-34` `joinByInvite` 성공 → 200 JoinResult. `invites/join/route.test.ts > 유효 미사용 코드 합류 시 200과 JoinResult(크루 active=true)를 반환한다` | ✅ | file:line |
| AC-15 (권한 경계) | 크루가 초대 생성 → 403 | `src/app/api/invites/route.ts:13-16` `role !== "master" → 403`. `invites/route.test.ts > 크루 역할은 초대 생성 시 403을 반환한다` | ✅ | file:line |

### FR-6 수락 마스터 게이트

| AC# | 내용 | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| AC-16 (UI) | 크루일 때 수락 버튼 미표시 | `src/features/attendance/components/EditRequestList.tsx:41` `req.status === "대기" && canApprove && onApprove`. `src/features/attendance/components/AttendanceDetail.tsx:177` `canApprove={user.role === "master"}` | ✅ | file:line |
| AC-17 (UI) | 마스터일 때 수락 버튼 표시 | `src/features/attendance/components/AttendanceDetail.tsx:177` `canApprove={user.role === "master"}` + `EditRequestList.tsx:41` | ✅ | file:line |
| AC-18 (API) | 크루 approve → 403 + store 불변 | `src/app/api/attendance/requests/approve/route.ts:11-16` `role !== "master" → 403 + approveRequest 미호출`. `approve/route.test.ts > 크루 역할은 수락 시 403을 반환하고 store에 반영하지 않는다` | ✅ | file:line |
| AC-19 (API) | 마스터 approve → 200 + 상태 전이 | `src/app/api/attendance/requests/approve/route.ts:27-36` 마스터 → `approveRequest(id)` → 200. `approve/route.test.ts > 마스터 역할은 수락 시 200으로 store에 반영한다` | ✅ | file:line |

### 회귀 AC

| AC# | 내용 | 충족 증거 | 일치 | 증거 유형 |
|---|---|---|---|---|
| AC-R1 | 기존 138 테스트 전부 통과 | `pnpm test` → 21 files / 175 passed. 기존 138 무수정 GREEN (구현노트 청크3 §회귀 게이트 결과) | ✅ | file:line |
| AC-R2 | crewId 미지정 호출 → 김민정 기본 | `src/lib/store.ts:131-132` `getMonthRecords(month, crewId=DEFAULT_CREW_ID)`. `store.crews.test.ts > 인자 생략 시 김민정(DEFAULT_CREW_ID) 데이터를 반환한다 (회귀, AC-R2)` | ✅ | file:line |
| AC-R3 | 김민정 시드 불변식(차감440/연장6·544/totalPay) | `seed.test.ts > seed 불변식 > ① ② ③ ④ ⑤` 6개 단언 PASS | ✅ | file:line |
| AC-R4 | breakStart/breakEnd 파생, 연장 산식, 휴게 범위 불변 | `src/lib/store.ts:41-70` `recalcClockFields` private 헬퍼 로직 불변. `seed.test.ts > ⑤ 근무일 breakStart/breakEnd 범위` PASS | ✅ | file:line |
| AC-R5 | 마스터 approve = 기존 동작 동일 | `src/lib/store.ts:307-383` `approveRequest` 로직 불변(게이트는 route 책임). `approve/route.test.ts > 마스터 역할은 수락 시 200으로 store에 반영한다` | ✅ | file:line |

---

## 경계면 검증

### API ↔ Frontend 헤더 계약

- `authHeaders(user)` → `{ "x-crew-id": user.crewId ?? user.id, "x-role": user.role }` (`useCurrentUser.ts:22-26`)
- `readScope(req)` → `{ role: headers.get(HEADER_ROLE) ?? "crew", crewId: headers.get(HEADER_CREW_ID) ?? DEFAULT_CREW_ID }` (`scope.ts:15-18`)
- 상수 키: `HEADER_CREW_ID = "x-crew-id"`, `HEADER_ROLE = "x-role"` (`constants.ts:58-59`)
- **일치 확인**: 클라가 보내는 헤더 키 = 서버가 추출하는 키 동일. fallback값도 양측 `DEFAULT_CREW_ID` / `"crew"` 일치.

### enforceReadScope ↔ 전체 API 라우트 적용 일관성

| 라우트 | 적용 여부 | 위치 |
|---|---|---|
| GET /api/attendance | ✅ | `attendance/route.ts:19-23` |
| PATCH /api/attendance | ✅ | `attendance/route.ts:31-34` |
| GET /api/attendance/[date] | ✅ | `attendance/[date]/route.ts` (scope 적용 확인) |
| GET /api/attendance/requests | ✅ | `requests/route.ts:14-23` |
| POST /api/attendance/requests | ✅ | `requests/route.ts:95-100` (crewId 태그) |
| GET /api/pay | ✅ | `pay/route.ts:15-19` |
| GET /api/pay/[date] | 별도 확인 필요 (본 검증 범위 내 코드 확인) |
| GET /api/profile | ✅ | `profile/route.ts:20-22` |
| PATCH /api/profile | ✅ | `profile/route.ts:26-50` |
| POST /api/attendance/requests/approve | ✅ | `approve/route.ts:11-16` (마스터 게이트) |
| GET /api/master/crews | ✅ | `master/crews/route.ts:13-17` (마스터 게이트) |
| POST /api/invites | ✅ | `invites/route.ts:13-16` (마스터 게이트) |
| POST /api/invites/join | (인증 불필요, 코드 검증) |

### PRD 데이터 모델 ↔ DB schema(store) 일치

- `StoreShape` (`store.ts:73-81`) = 아키텍처 §2.2 설계 일치 (`crews`, `recordsByCrew`, `requests`, `invites`, `profilesByCrew`, `storeInfo`, `seq`)
- `Crew`, `User`, `Invite`, `CrewSummary`, `MasterSummaryResponse`, `JoinResult` 타입 = `types/index.ts:111-165` 아키텍처 §2.1 shape 일치
- `AttendanceRecord.crewId?` / `EditRequest.crewId?` append = PRD §3.1 전략 A 충족

### 하이드레이션 경계

- `CurrentUserProvider` 초기 state = `INITIAL_USER`(김민정) — SSR/CSR 1차 동일 → localStorage는 mount 후 `useEffect`에서만 (`CurrentUserProvider.tsx:42-49`)
- `BottomNav` mount 게이트: `useSyncExternalStore` → mount 전 크루 4탭, mount 후 role=master면 탭 교체 (`BottomNav.tsx:88-93`)
- `MasterView` mount 게이트: `useSyncExternalStore` → mount 후 role≠master면 `router.replace("/")` (`MasterView.tsx:21-36`)

---

## 빌드/테스트 결과

- **단위 테스트**: ✅ `pnpm test` → 21 files / **175 passed** (기존 138 + 신규 37)
  - seed.crews.test.ts: 6/6
  - store.crews.test.ts: 15/15
  - scope.test.ts: 4/4
  - approve/route.test.ts: 6/6 (기존 4 + 신규 2)
  - invites/route.test.ts: 3/3
  - invites/join/route.test.ts: 4/4
  - master/crews/route.test.ts: 3/3
- **타입체크**: ✅ `npx tsc --noEmit` → exit 0 (0 error)
- **Lint**: ✅ `pnpm lint` → 0 error / 0 warning
- **빌드**: ✅ `pnpm build` → 성공

빌드 라우트 목록 확인:
```
ƒ /api/invites
ƒ /api/invites/join
ƒ /api/master/crews
ƒ /api/crews
○ /master
```
신규 5개 라우트 모두 생성 확인.

---

## 자동 추가 검증 항목

### AC-Struct (프로젝트 구조 준수)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Struct-1 | 신규 파일 배치 | ✅ `src/features/accounts/` (architect §1.1 지정), `src/app/api/master/`, `src/app/api/invites/`, `src/app/master/` 모두 규약 경로 |
| AC-Struct-2 | 폴더 책임 침범 금지 | ✅ `scope.ts`는 `src/lib/`에만 위치, client store 직접 import 0 (route 경유 확인) |
| AC-Struct-3 | user_notes 규칙 준수 | ✅ 계정 도메인 = `features/accounts/`, 공용 타입 = `types/index.ts` append |

### AC-Proj (프로젝트 자원 활용)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Proj-1 | 컨벤션 준수 | ✅ leaf 단일출처(`@/types`), server-only store, `"use client"` 경계, no-store fetch, append-only 전략 모두 준수 |
| AC-Proj-2 | 명시된 자원 활용 | ✅ ADR 0004 append-only 전략 계승, ADR 0001 인메모리 store 유지, `pnpm test/lint/build` 직접 호출 |
| AC-Proj-3 | craft 우선 활용 | ✅ 기존 `buildSeedRecords()` 재사용, `recalcClockFields` private 헬퍼 로직 불변 |

### AC-Repo (Repository Artifacts)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Repo-1 | CONTEXT.md 갱신 | ✅ `CONTEXT.md` T8 신규 용어 누적 20개 추가 확인 (`마스터`, `크루`, `crewId 스코프`, `초대`, `크루 집계`, `현재 사용자 전달`, `읽기 스코프 강제`, `수락 마스터 게이트`, `현재 사용자 컨텍스트`, `역할전환`, `마스터 집계뷰`, `크루 집계 행`, `초대 플로우 API`, `role별 바텀탭` 등) |
| AC-Repo-2 | ADR 작성 | ✅ `docs/adr/0005-accounts-roles-mock.md` 신규 생성. 결정 2건(crewId 스코프 전략 A+헤더 / mock 역할전환 신뢰모델) 포함 |
| AC-Repo-3 | 갱신 시점 적절성 | ✅ 커밋 1e295a1 (T8-6/5/8 최종) 내 CONTEXT.md + ADR 0005 동시 변경 |

---

## 권한 경계 검증 (핵심 — 크루 격리·마스터 게이트 3곳)

### 1. 크루 본인 강제 스코프 (`enforceReadScope`)

**코드 (`scope.ts:26-28`)**:
```typescript
export function enforceReadScope(scope: Scope, requested?: string): string {
  return scope.role === "master" ? (requested ?? scope.crewId) : scope.crewId;
}
```

- 크루: `requested` 무시 → 본인 `crewId` 강제. 타인 데이터 노출 0 (AC-8 충족).
- 마스터: `requested` 허용, 없으면 `self`.
- 헤더 부재 → `role="crew"`, `crewId=DEFAULT_CREW_ID` fallback → 김민정 스코프.
- 테스트 확인: `scope.test.ts > 크루는 requested를 무시하고 본인 crewId를 강제한다` (PASS)
- 적용 라우트: `/api/attendance`, `/api/attendance/[date]`, `/api/pay`, `/api/profile` 모두 `enforceReadScope` 경유 확인 (file:line 매핑 완료).

**판정**: ✅ 일관 적용. 크루 격리 경계 충족.

### 2. 마스터 게이트 3곳

| 게이트 | 위치 | 조건 | 크루 차단 |
|---|---|---|---|
| approve | `approve/route.ts:11-16` | `role !== "master" → 403 + approveRequest 미호출` | ✅ 테스트 확인 |
| /api/master/crews | `master/crews/route.ts:13-17` | `role !== "master" → 403` | ✅ 테스트 확인 |
| /api/invites (POST) | `invites/route.ts:13-16` | `role !== "master" → 403` | ✅ 테스트 확인 |

세 게이트 모두 동일 패턴(`readScope(req).role !== "master" → 403`) 적용. UI 숨김(canApprove / role별 탭 / InvitePanel role 분기)과 이중 방어.

### 3. E-7 권한 우회 (헤더 위조) 분석

PRD §E-7 및 ADR 0005: mock 신뢰 모델 — 클라이언트 헤더 선언 신뢰, 위조 방어 없음(의도된 제약). 정상 클라 경로에서 크루 UI에 수락/마스터뷰 진입점 없음: ✅ 확인(MASTER_TABS에만 `/master`, `canApprove={role==="master"}` UI 조건). ADR 0005 "클라이언트 선언 + 서버 게이트 이중 방어" — mock 데모 의도된 trade-off.

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 19 + 5 = 24개
- file:line 증거: 24개
- test ID 증거: 24개 (file:line과 동반)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

**AC 정량 증거 보유율: 24/24 = 100%**

---

## 🤝 교차 검증 (codex review)

- 자체 판정(하네스축): PASS 후보
- codex 호출: `codex review --base 70eeb16` (gpt-5.5, read-only sandbox)
- codex 판정: **FAIL** — P1 4건 + P2 1건

### codex 지적 상세

**[P1-1] 크루2/3 급여 주휴수당 오산정 — `src/app/api/pay/route.ts:19-20`**

`buildPayItems(records)`가 내부에서 `WEEKLY_HOLIDAY.date`(5월)를 포함하는 레코드 집합이면 무조건 67,080원 블루행을 추가한다. crew-2, crew-3에도 5월 레코드가 있으므로 이들의 급여 화면에 김민정의 주휴수당 67,080원이 잘못 표시된다.

**차단성 판정**: 코드 버그이나, PRD §3.1에서 "김민정 외 크루는 불변식 강제 없이 '0건 이상 + 본인 격리'만 보장하면 충분"으로 명시되어 있고, AC는 이 케이스의 자동 테스트를 요구하지 않는다. 또한 주휴수당 산식은 비목표(PRD §2.2 "시드 고정값(67,080원 1건)으로 처리, 산식 비구현"). 실제 crew-2/3 급여 AC 테스트가 없어 지금 단계에서 차단 요소는 아니나, 의도하지 않은 데이터 오표시이므로 **follow-up P1** 후보.

**[P1-2] 마스터 수락 UI 경로 미완성 — `src/features/accounts/components/CrewSummaryList.tsx:27-30`**

마스터가 크루의 수정요청을 UI로 수락할 수 있는 경로가 없다. `CrewSummaryList`에 드릴다운 없고, 마스터 `BottomNav`에는 출퇴근 탭이 없어 `AttendanceDetail`에 접근이 불가하다. 수락 게이트 API(AC-18/19)와 UI `canApprove` prop(AC-16/17)은 구현되어 있으나, **마스터가 실제로 수락 버튼에 도달하는 UI 경로가 없다**.

**차단성 판정**: AC-17은 "마스터일 때 수락 버튼이 표시된다"이며, `AttendanceDetail`에 `canApprove={role==="master"}`가 배선되어 있다. 그러나 마스터 BottomNav에는 출퇴근(/attendance) 탭이 없어 `AttendanceDetail` 자체에 마스터가 접근하기 어렵다. AC-11에서 "특정 크루 선택 시 해당 크루의 근무/휴일 상세를 볼 수 있다(읽기)"라고 명시되어 있으나 `CrewSummaryList`에 드릴다운 링크가 없다. **AC-11 미충족 (구현 미흡)**. 분류 A(품질 미흡 — 드릴다운 경로 누락).

**[P1-3] 전환 시 stale 데이터 노출 — `src/features/mypage/hooks/useProfile.ts:24-26`**

계정 전환 직후 effect가 재실행되어 새 fetch가 시작되지만, `data`/`loading` 리셋이 없어 이전 사용자 데이터가 새 fetch 완료 전까지 표시된다. `useAttendance`, `usePay` 동일 패턴.

**차단성 판정**: PRD §3.5 E-3에서 "전환 직후 화면 데이터가 즉시 새 사용자 스코프로 갱신되어야 함(이전 사용자 데이터 잔존 금지)"이라고 명시. 아키텍처 §4에서 "active cleanup으로 stale 차단"이라고 했으나 이는 동시 요청의 stale 응답 차단(cleanup → active=false)이며, 화면에 이전 데이터를 보여주는 문제는 `loading=true + data=null` 리셋이 별도 필요하다. **E-3(AC-3a 수준) 미충족**. 분류 A(품질 미흡).

단, active cleanup이 있으므로 타인 데이터가 최종 표시되지는 않는다(race condition 차단). 전환 직후 "찰나의 이전 데이터 표시" 정도의 수준이며, 실제 데이터 노출 위험은 낮다.

**[P1-4] active=false 크루 멤버십 게이트 미적용 — `src/lib/store.ts:463-465`**

`listCrews()`가 `active=false` 크루도 포함하여 반환해 `RoleSwitcher`에 노출된다. 단 현재 시드가 모든 크루를 `active=true`로 초기화하므로, 초대 플로우를 거치지 않은 상태에서도 합류 상태가 된다. "초대로만 합류"라는 PRD 요구는 시드 설계상 시연이 어렵다.

**차단성 판정**: 시드 데이터가 `active=true`인 것은 ARD 설계("초대 시드(mock). 초기 빈 배열 — 마스터가 런타임에 생성")의 trade-off이다. `buildSeedCrews()`의 `active: true`가 의도된 mock(이미 합류된 상태로 시작)이며, PRD §1.3에서 "멀티 크루 데이터: 김민정 포함 크루 2~3명 mock 시드(각자 근무기록·스케줄)"로 명시했다. 초대 플로우 자체(AC-13/14/15)는 동작하며, active 게이트를 RoleSwitcher에 추가하면 시드 설계 변경이 필요하다. PRD의 명시적 AC에 "active=false 크루를 RoleSwitcher에서 숨겨야 함"은 없다 → **REWORK 대상 아님**, follow-up 메모로 처리.

**[P2-1] 초대 코드 소진 후 존재하지 않는 crewId 처리 — `src/lib/store.ts:541-545`**

유효 코드 + 미등록 crewId 조합 시 코드를 `사용`으로 소진한 뒤 ephemeral Crew를 반환하고 store에는 저장하지 않는다. 코드가 영구 소진되는 문제.

**차단성 판정**: mock 신뢰 모델의 known limitation. PRD §1.3 "멀티 크루 3명 mock 시드"로 crewId가 사전 등록된 상황만 상정. AC-14 테스트에서 `"crew-2"` 기존 크루 ID를 사용하고 있어 정상 플로우에서 발생하지 않음. P2 비차단.

### 종합 codex 판정

- **P1 4건 중**: P1-2(AC-11 드릴다운 미충족), P1-3(E-3 stale 노출) → **차단**. P1-1(주휴수당 오산정 follow-up), P1-4(active 시드 trade-off) → 비차단.
- **P2 1건**: P2-1 비차단.
- **codex 코드축 결과**: **FAIL** (P1-2, P1-3 차단)

`gate_mode: and` 기준 → 하네스축 PASS이나 codex 코드축 FAIL → **최종 PASS 금지**.

---

## 회귀 검증 (seed 불변식 — AC-R1~R5)

| 항목 | 검증 결과 |
|---|---|
| 기존 138 테스트 GREEN | ✅ 175 passed (138 기존 + 37 신규) |
| `buildSeedRecords()` 시그니처·반환 불변 | ✅ `seed.ts:102-117` 무변경 |
| 차감Σ=440 | ✅ `seed.test.ts > ① 급여차감시간 합계 = 440분` PASS |
| 연장 6회·Σ544분 | ✅ `seed.test.ts > ② 연장 6회 / 합계 544분` PASS |
| totalPay = Σitems.amount (주휴 67,080 포함) | ✅ `seed.test.ts > ③ totalPay = Σ items.amount` PASS |
| 5/28 392분·overtime 0 | ✅ `seed.test.ts > ④ 5/28 실근무 392분 인정` PASS |
| 휴게 범위 11:30~12:00 | ✅ `seed.test.ts > ⑤ 근무일은 breakStart=11:30/breakEnd=12:00` PASS |
| `recalcClockFields` 로직 불변 | ✅ `store.ts:41-70` 보정 0줄 |
| approveRequest 정책 보존 | ✅ `approve/route.test.ts > 유효 대기 요청 수락 시 200` + 멱등 no-op PASS |
| append-only | ✅ 9개 store 함수 trailing `crewId=DEFAULT_CREW_ID` — 기존 호출 무영향 |

**회귀 0 확인. seed 불변식 전부 통과.**

---

## 최종 판정

**판정: REWORK (A)**

**사유**: AC 19+5 중 17+5 = 22개 충족(91%). 하네스축 PASS 후보였으나 codex 코드축이 **FAIL** (P1-2, P1-3 차단 지적). `gate_mode: and`에 따라 하네스축 단독 PASS 불가.

- **AC-11 미충족**: `CrewSummaryList`에 크루별 근무/휴일 상세 드릴다운 경로 없음 — 마스터가 집계행 선택 시 해당 크루 상세를 볼 수 없음.
- **E-3 미충족**: 계정 전환 직후 데이터 훅이 `data=null + loading=true` 리셋 없이 이전 사용자 데이터를 유지하다가 새 fetch 완료 시 교체 — "즉시 새 사용자 스코프로 갱신" 요건 부분 미충족.

**회귀 지점**: developer

**수정 요청 항목 (Rework A — 품질 미흡)**:

1. **AC-11 드릴다운 경로 추가** (`CrewSummaryList` 또는 `MasterView`): 마스터가 집계행의 특정 크루를 선택하면 해당 크루의 근무/휴일 상세를 볼 수 있어야 한다. 구현 방식은 developer 재량(예: `CrewSummaryList` 각 행에 `/attendance?crewId=` 링크 + 마스터 BottomNav에 해당 경로 접근 허용, 또는 MasterView 내 인라인 상세 섹션).

2. **E-3 전환 시 stale 데이터 즉시 초기화**: 계정 전환(`crewId` effect 의존성 재실행) 시 effect 시작 직후 `setData(null); setLoading(true)` 리셋 추가. `useProfile.ts`, `useAttendance.ts`(`useMonthAttendance`/`useDayAttendance`/`useEditRequests`), `usePay.ts` 세 훅에 동일 패턴 적용.

---

## follow-up 항목 (REWORK 대상 아님 — 별도 task 후보)

| 우선순위 | 항목 | 사유 |
|---|---|---|
| P1 | crew-2/3 급여 주휴수당 분리 (`buildPayItems` 크루별 주휴수당 스코프) | `pay/route.ts:19-20` — 현재 김민정 고정 `WEEKLY_HOLIDAY`를 크루별로 분리하지 않음. 5월 레코드가 있는 crew-2/3에도 67,080원 블루행이 잘못 표시됨. 이번 PRD §2.2에서 "주휴수당 = 시드 고정값(67,080원 1건)"이나 멀티크루 확장에서 재정의 필요 |
| P2 | 초대 코드 소진 + 미등록 crewId 방어 (`joinByInvite` 검증 순서) | `store.ts:541-545` — 코드 validate 전 invite 소진. mock 범위에선 무해하나 실제 배포 전 수정 권장 |
| P2 | active=false 크루 RoleSwitcher 표시 정책 명확화 | 현재 시드가 모두 `active=true` → 초대 플로우 시연을 위해 일부 크루를 `active=false`로 시드하고 RoleSwitcher에서 분리 표시(예: "초대 대기") 또는 숨김 처리 |
