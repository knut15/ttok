# 📋 PRD (v1) — 크루 출근 격리 버그수정 + 마스터 수정요청 컨펌 + 아이콘 버튼 통일

- **Task**: 2026-06-01-crew-clock-master-confirm
- **작성자**: task-planner
- **상태**: 승인 대기
- **유형**: 기존 Crewmon 앱 확장 (버그수정 2 + UI 통일 1)
- **참조 디자인**: `public/sample/IMG_3609.png`(수정요청 수락 표기 — 이력 행 `수락` 배지), IMG_3617(알림)

---

## 1. 배경 / 문제 정의

Crewmon은 인메모리 store 기반 멀티크루 출퇴근·급여 앱이다(ADR 0004로 `crewId` 스코프 격리 도입, `CONTEXT.md` §"crewId 스코프"/"읽기 스코프 강제" 참조). 현 시점에서 3개의 결함·미비점이 확인되었다.

### FR-1 — 크루 출근 격리 버그 (근본원인 확정)
홈 출퇴근 토글 `ClockToggle`이 GET `/api/attendance/[date]`·PATCH `/api/attendance`를 **`authHeaders(user)` 없이** 호출한다(`src/features/attendance/components/ClockToggle.tsx` L20, L38). 헤더 부재 시 서버 `readScope`는 `role=crew, crewId=crew-minjung`(김민정)으로 폴백한다(`src/lib/scope.ts` L15-19). 결과적으로 **현재 로그인 크루가 누구든 모든 출퇴근 기록이 김민정 레코드에 쓰이고 읽힌다** → 한 크루가 출근하면 전원이 "출근됨"으로 표시되는 데이터 누수. (대조군: `useAttendance.ts`의 훅들은 이미 `authHeaders` + `crewId` effect 의존성으로 올바르게 구현되어 있다 — `ClockToggle`만 누락.)

### FR-2 — 마스터 수정요청 컨펌 UI/API 부재
크루가 근태 수정요청(`EditRequest`)을 생성하면 `crewId`가 태그된다(`store.ts` `addRequest`). `approveRequest`·`POST /api/attendance/requests/approve`(마스터 게이트 403 포함)는 이미 존재한다(`CONTEXT.md` §"수락 마스터 게이트"). 그러나 **마스터가 전체 크루의 수정요청을 한 화면에서 조회·수락하는 경로가 없다.** 현 `GET /api/attendance/requests`는 마스터일 때 전체를 반환할 수 있으나(`route.ts` L19-23) 이를 소비하는 마스터 전용 화면이 없고, `/master`는 집계뷰만 노출한다. 마스터는 현재 개별 날짜 상세(`AttendanceDetail`)에서 본인 스코프 요청만 보게 되어 타 크루 요청을 수락할 수 없다.

### FR-3 — 아이콘 전용 버튼 클릭영역 불일치
텍스트 없는 아이콘 버튼(월 네비 `‹ ›`, 홈/마이페이지 `🔔`, 프로필 `📷`, 상세 뒤로/이전·다음 `‹ ›`, 캘린더 다운로드 `⤓` 등)이 컴포넌트마다 `text-2xl`/`text-xl`/`text-muted` 등 제각각의 스타일을 쓰고 클릭(터치) 영역이 글리프 크기에 종속된다. 터치 타겟이 작고 일관성이 없다.

---

## 2. 목표 / 비목표

### 목표
- (FR-1) 크루별 출근 기록이 **본인 `crewId`에만** 기록·조회되어 타 크루에 노출되지 않는다.
- (FR-2) 마스터가 **전체 크루의 수정요청을 한 화면에서 조회하고 수락**할 수 있다(크루 이름 표시 포함). 크루는 본인 요청만(현행 유지).
- (FR-3) 아이콘 전용 버튼의 클릭 영역을 **32×32(`h-8 w-8` + 중앙정렬)** 로 통일한다.
- 기존 186개 테스트 회귀 0, 권한 경계·하이드레이션 안전 유지.

### 비목표 (Out of Scope)
- 수정요청 **거절/철회/수락취소** 기능 (현행 미지원 유지, `CONTEXT.md` §EditRequest).
- 알림(🔔) **실기능**(클릭 동작·뱃지 카운트 연동) — FR-3는 클릭영역 스타일 통일만, 동작 추가 없음.
- 텍스트가 있는 버튼(상태변경/시간변경/수정요청/급여명세서/수락 등)의 크기 변경 — 32×32 대상 아님.
- 새 디자인 토큰/공용 IconButton 컴포넌트 신설 강제 — 권장이되 architect 판단에 위임(§Unresolved Q-3).
- 실 DB·인증 도입(인메모리 store 유지).
- 출근시각(`clockIn`) 산식·연장 정책 변경(불변).

---

## 3. 솔루션 개요

**FR-1**: `ClockToggle`을 `useCurrentUser`로 현재 크루를 인지하게 하고, GET/PATCH fetch에 `authHeaders(user)`를 spread한다. 더불어 `useEffect` 의존성에 `crewId`(= `user.crewId ?? user.id`)를 추가하여 역할/계정 전환 시 이전 크루 레코드가 무효화·재fetch되도록 한다(기존 `useAttendance.ts` 훅들과 동일 패턴 — active cleanup으로 stale 차단). 서버 측 변경 없음(`scope.ts`/route는 이미 헤더 처리). 가장 안전한 옵션은 `ClockToggle`을 `useDayAttendance` 훅으로 이관하는 것이나(중복 제거), 토글은 PATCH body가 `{field, time}`이고 훅의 `changeStatus`는 `{status}`라 시그니처가 달라 **최소 수정(authHeaders + crewId 의존성 직접 추가)** 을 1차 권고하고, 훅 확장 여부는 architect에 위임(§Unresolved Q-2).

**FR-2**: 마스터 전용 조회 API `GET /api/master/requests` 신규 — 마스터 게이트(role≠master → 403), 통과 시 `listRequests()`(crewId 생략=전체) 반환. 응답에 크루 이름 매핑을 포함하기 위해 `listCrews()`로 `crewId→name`을 조인하여 `{request, crewName}[]` 형태로 내려주거나, 응답은 `EditRequest[]` 그대로 두고 클라가 `GET /api/crews`로 매핑한다(둘 중 선택은 §Unresolved Q-1과 함께 architect 권고). 마스터 화면에서 목록 + 수락 버튼을 렌더하고, 수락 시 기존 `POST /api/attendance/requests/approve`(마스터 게이트) 호출 → `approveRequest`가 `req.crewId`로 해당 크루 레코드에 반영 → 목록 reload. UI 위치(`/master` 섹션 vs 별도 라우트)는 §Unresolved Q-1.

**FR-3**: 아이콘 전용 버튼들을 `class="grid h-8 w-8 place-items-center ..."`(또는 `inline-flex items-center justify-center`)로 통일. 글리프 폰트크기는 가독 범위에서 유지하되 클릭 박스를 32×32로 고정. `aria-label`이 없는 글리프(홈 `🔔` span 등)는 클릭 가능 요소가 아니면 대상 제외 — "버튼"으로 동작하는 요소만 대상으로 한다(§4 대상 목록 확정).

### 활용할 프로젝트 자원
- `CONTEXT.md` §"crewId 스코프"/"읽기 스코프 강제"/"수락 마스터 게이트"/"현재 사용자 컨텍스트"/"역할전환": FR-1·FR-2 권한·격리 정의의 단일 출처 — phase 2.5/3 작성 기준 (정독 완료).
- `src/features/accounts/hooks/useCurrentUser.ts`(`authHeaders`): FR-1 헤더 부착 — phase 3에서 호출.
- `src/lib/scope.ts`(`readScope`/`enforceReadScope`): FR-2 신규 API 게이트 재사용 — phase 3.
- `src/lib/store.ts`(`listRequests(crewId?)`, `approveRequest`, `listCrews`): FR-2 전체 조회·수락·이름매핑 재사용(신규 store 함수 불필요 가능) — phase 3.
- `src/features/attendance/components/EditRequestList.tsx`(`canApprove` prop): FR-2 마스터 목록 렌더 재사용 후보 — phase 2.5/3.
- 기존 라우트 테스트 패턴(`*/route.test.ts`, `__resetStore`): FR-1·FR-2 통합테스트 작성 기준 — phase 3.

### 프로젝트 구조 (feature-based, append-only)
- 패턴: feature-based (`src/features/{attendance,accounts,...}`) + Next.js App Router route handlers (`src/app/api/...`).
- 신규 산출물 배치:
  - 신규 API → `src/app/api/master/requests/route.ts` (+ `route.test.ts`) — 기존 `api/master/crews` 패턴 답습.
  - 마스터 수정요청 UI → `src/features/accounts/components/` (예 `MasterRequestList.tsx` 또는 `MasterView` 섹션 확장) — §Unresolved Q-1 결정에 따름.
  - 데이터 훅(필요 시) → `src/features/accounts/hooks/` (예 `useMasterRequests.ts`).
  - FR-3 변경은 기존 컴포넌트 in-place 수정(append-only 원칙 하 className 교체).

---

## 4. FR-3 대상 버튼 목록 (코드 식별 결과 — 변경 baseline)

아이콘 전용(텍스트 없는) **클릭 가능** 요소만 대상. grep(`aria-label`/글리프) + 정독으로 확정한 목록:

| # | 파일 | 위치 | 아이콘 | 현재 클래스(요지) | 대상 여부 |
|---|---|---|---|---|---|
| 1 | `AttendanceCalendarView.tsx` | L37,48 | `‹` `›` 월네비 | `text-muted` | ✅ |
| 2 | `PayView.tsx` | L38,49 | `‹` `›` 월네비 | `text-muted` | ✅ |
| 3 | `MasterView.tsx` | L54,63 | `‹` `›` 월네비 | `text-muted` | ✅ |
| 4 | `MasterCrewDetail.tsx` | L76,85 | `‹` `›` 월네비 | (정독 확인 필요) | ✅ |
| 5 | `AttendanceDetailNav.tsx` | L18,32,40 | `‹` 뒤로 / `‹` `›` 일자네비 | `text-2xl leading-none text-muted` | ✅ (3개) |
| 6 | `BackButton.tsx` | L9 | `‹` 뒤로 | `text-2xl text-foreground` | ✅ |
| 7 | `ProfileForm.tsx` | L47 | `📷` 사진변경 | `grid h-8 w-8 place-items-center ...` | ⚠️ **이미 32×32** (검증·일관성 확인만) |
| 8 | `AttendanceCalendarView.tsx` | L58 | `⤓` 다운로드 | `text-muted` (span, 비버튼) | ⚠️ 클릭 동작 없음 — Q-4 |
| 9 | `app/page.tsx` | L14 | `🔔` 홈 알림 | `text-xl text-muted` (span, `aria-hidden`) | ❌ 비클릭 span (Q-4) |
| 10 | `MyPageView.tsx` | L25 | `🔔` 알림 | `aria-label="알림"` span (비클릭) | ❌ 비클릭 span (Q-4) |

**확정 대상(클릭 가능 버튼)**: #1~#6 = `‹`/`›` 월네비 4쌍(8개) + 상세 네비 3개 + BackButton 1개 = **12개 버튼**. #7은 이미 32×32라 정렬 일관성 검증만. #8~#10(`⤓`/`🔔`)은 현재 클릭 동작이 없는 `span`이라 "아이콘 버튼"이 아님 → §Unresolved Q-4로 승인자 판단 위임(터치영역만 통일할지/현행 유지할지). **AC-7의 측정 기준 개수는 Q-4 결정 후 확정**하되, 본 PRD는 최소 12개를 baseline으로 둔다.

---

## 1.5 Sub-task 분해

| # | Sub-task | 산출물 | 사용 가능한 자원 | 의존 |
|---|---|---|---|---|
| **S1** | FR-1 `ClockToggle` 격리 수정 | `ClockToggle.tsx` 수정: `useCurrentUser` + `authHeaders` spread(GET·PATCH) + `crewId` effect 의존성 + active cleanup | `useCurrentUser`/`authHeaders`, `useAttendance.ts` 패턴 | — |
| **S2** | FR-1 통합테스트 | `api/attendance/route.test.ts`/`[date]/route.test.ts`에 크루별 격리 케이스 추가 (크루A PATCH가 크루A 레코드만 변경, 크루B 미영향) | `__resetStore`, 기존 route.test 패턴 | S1 무관(서버는 기존) |
| **S3** | FR-2 마스터 조회 API | `src/app/api/master/requests/route.ts` + `route.test.ts` (마스터 게이트, 전체 pending+이력, 크루 이름 매핑 포함 여부 Q-1) | `readScope`, `listRequests`, `listCrews`, `api/master/crews` 패턴 | — |
| **S4** | FR-2 마스터 컨펌 UI | 마스터 수정요청 목록 컴포넌트 + 수락 핸들러(`/master` 섹션 또는 별도 라우트), 크루 이름 표시, 수락 후 reload | `EditRequestList`(canApprove), `useEditRequests.approve`, `MasterView` | S3 |
| **S5** | FR-3 아이콘 버튼 32×32 통일 | §4 확정 대상(최소 12개) className → `h-8 w-8` + 중앙정렬 | §4 대상 표 | Q-4 결정 |

---

## 5. Acceptance Criteria (객관 검증 가능)

### FR-1 — 크루 출근 격리

- **AC-1** (격리 기록): Given 현재 사용자가 크루B(`crew-2`)이고 홈 진입, When 출근 토글을 누르면, Then PATCH `/api/attendance?date=<today>`가 `x-crew-id: crew-2` 헤더와 함께 전송되고 `crew-2`의 오늘 레코드만 `clockIn`이 기록된다.
- **AC-2** (타 크루 무노출): Given 크루B가 오늘 출근 기록을 만든 상태, When 크루A(`crew-3`)로 전환하여 홈을 보면, Then 크루A의 `ClockToggle`은 `phase==="before"`("오늘도 화이팅!" + "출근" 버튼)로 렌더되며 크루B의 출근이 보이지 않는다.
- **AC-3** (전환 무효화): Given 크루B 홈에서 출근 표시 중, When `RoleSwitcher`로 크루A로 전환하면, Then `crewId` 의존성 변경으로 record가 즉시 리셋·재fetch되어 stale(크루B) 데이터가 1프레임도 노출되지 않는다(active cleanup).
- **AC-4** (서버 통합테스트): Given store 시드(`__resetStore`), When `x-crew-id: crew-2` 헤더로 PATCH `?date=2026-06-01` `{field:"clockIn", time:"09:00"}` 후 `x-crew-id: crew-3` 헤더로 GET `/api/attendance/2026-06-01` 하면, Then `crew-2`는 09:00 clockIn 레코드 / `crew-3`은 404(레코드 없음)를 반환한다.

### FR-2 — 마스터 수정요청 컨펌

- **AC-5** (마스터 전체 조회): Given 크루B·크루A가 각각 수정요청을 1건씩 생성, When 마스터(`x-role: master`)가 `GET /api/master/requests`를 호출하면, Then 두 요청이 모두 포함된 목록(최신순)을 200으로 받는다.
- **AC-6** (크루 이름 표시): Given AC-5의 목록, When 마스터 화면에 렌더되면, Then 각 요청 행에 해당 `crewId`에 매핑된 크루 이름(예 "김민정"/크루명)이 표시된다.
- **AC-7** (수락 반영): Given 크루B의 대기 수정요청(after.clockOut 변경), When 마스터가 수락 버튼을 누르면, Then `POST /api/attendance/requests/approve`(마스터 게이트 통과)로 `req.crewId=crew-2` 레코드가 `after`로 반영되고 요청 status가 `대기→수락`으로 전이되며 목록이 reload되어 `수락` 배지로 표기된다(IMG_3609 이력 행 형식).
- **AC-8** (크루 403): Given 현재 사용자가 크루(`x-role: crew`), When `GET /api/master/requests`를 호출하면, Then **403**을 반환하고 목록을 노출하지 않는다(API 게이트 + UI 미노출 이중 방어).
- **AC-9** (크루 본인 스코프 불변): Given 크루B가 본인 수정요청 화면(`AttendanceDetail`/`useEditRequests`)을 보면, Then 현행대로 본인 `crewId` 태그 요청만 보이고 타 크루 요청은 보이지 않는다(회귀 0).

### FR-3 — 아이콘 버튼 32×32

- **AC-10** (32×32 적용): §4 확정 대상(최소 12개) 아이콘 전용 버튼은 모두 클릭 박스가 **`h-8 w-8`(32×32px)** 이고 아이콘이 박스 중앙에 정렬된다(`grid place-items-center` 또는 `inline-flex items-center justify-center`).
- **AC-11** (텍스트 버튼 불변): 텍스트가 있는 버튼(상태변경/시간변경/수정요청/급여명세서/수락 등)은 크기·스타일이 변경되지 않는다.
- **AC-12** (누락 0 검증): grep 또는 테스트로 §4 대상 목록의 모든 항목이 `h-8 w-8`(또는 합의된 동등 클래스)를 포함함을 확인한다(누락 0). 적용 개수 = §4 확정 개수와 일치.

### 회귀 방지 (전 FR 공통)

- **AC-R1**: 기존 **186개 테스트 전부 통과**(회귀 0).
- **AC-R2** (크루 본인 스코프 유지): 크루는 `enforceReadScope`로 본인 데이터만 조회·변경(타인 노출 0) — `scope.test.ts` 통과 유지.
- **AC-R3** (마스터 게이트 유지): `POST /api/attendance/requests/approve` 및 신규 `GET /api/master/requests`는 role≠master → 403, store 불변(approve 미호출).
- **AC-R4** (김민정 기본 폴백): 헤더 부재 요청은 여전히 `crew-minjung`으로 폴백(`scope.test.ts`, 기존 route.test의 헤더없는 케이스 통과) — FR-1/FR-2 변경이 이 폴백을 깨지 않는다.
- **AC-R5** (하이드레이션 안전): FR-1 `ClockToggle`은 `HomeToday`의 mount-gate 하위에서 동작하며, FR-2 마스터 화면은 `MasterView`의 client mount-gate(role 미확정 시 리다이렉트 금지) 패턴을 따라 SSR/CSR mismatch 0.

---

## 6. 엣지 케이스

- **E-1** (전환 직후 토글): 크루 전환 직후 record 재fetch 완료 전 토글을 누르면 — fetch 미완료 상태에서 `record=null`(phase=before)이므로 clockIn PATCH가 현재 크루로 안전히 나간다(authHeaders는 user 기준). stale PATCH 발생 안 함을 확인(AC-3).
- **E-2** (수정요청 0건 마스터뷰): 마스터가 수정요청이 0건일 때 `GET /api/master/requests`는 빈 배열을 반환하고, 화면은 "수정요청이 없습니다"류 빈 상태를 표시한다(crash·undefined 0).
- **E-3** (이미 수락된 요청 재수락): 이미 `수락` 상태 요청의 수락 버튼은 노출되지 않으며(`EditRequestList`: `req.status==="대기" && canApprove`), API로 재호출되더라도 `approveRequest`가 멱등 no-op(레코드 불변, 200)을 보장한다(`CONTEXT.md` §EditRequest, store.ts L324-328).
- **E-4** (아이콘버튼 누락): §4 대상 중 일부만 변경되어 클릭영역이 불일치하면 AC-12 검증에서 탐지(누락 0 강제).
- **E-5** (오늘 레코드 없는 신규 크루): 초대 직후 합류한 크루가 첫 출근 토글 시 `upsertTodayClock`이 해당 `crewId` Map을 생성(없으면 빈 Map 등록)하여 본인에게만 기록된다(`store.ts` `crewRecords`).
- **E-6** (대용량/다수 크루 요청): 크루 N명이 각각 다수 요청을 만든 경우 `GET /api/master/requests`는 전체를 최신순 정렬 반환 — 정렬·이름매핑이 O(N)이며 누락·중복 0.

---

## 7. 메트릭 (성공 판정 정량 지표)

1. **격리 정확도**: FR-1 통합테스트에서 "크루A 변경 → 크루B 미영향" 케이스 **100% 통과**(누수 0건).
2. **회귀율**: 기존 186 테스트 통과율 **100%**(신규 테스트 추가 후 총계 증가, 기존 감소 0).
3. **아이콘 버튼 통일 적용률**: §4 확정 대상 중 `h-8 w-8` 적용 = **100%**(누락 0).

---

## 8. 의존성 / 선행 조건

- **선행 없음**(독립 task). 기존 `scope.ts`/`approve` API/`store` 함수가 이미 존재하므로 신규 서버 인프라 불필요.
- FR-2는 `listRequests(crewId?)`·`listCrews`·`approveRequest`(기존) 재사용 — 신규 store 함수 도입 여부는 이름매핑 방식(Q-1)에 종속.
- 테스트 러너(기존 vitest 추정)·`__resetStore` 격리 유틸 의존.

---

## 9. 리스크

- **R-1** (FR-1 회귀): `ClockToggle`에 `crewId` 의존성 추가 시 mount-gate(HomeToday) 하위에서 초기 김민정→실제 크루 전환에 따른 깜빡임. → active cleanup + 리셋 패턴(useAttendance 기존 검증된 패턴) 답습으로 완화.
- **R-2** (FR-2 권한 누수): 신규 API가 게이트를 빠뜨리면 크루가 전체 요청을 봄. → AC-8/AC-R3로 강제, `api/master/crews` 게이트 패턴 복제.
- **R-3** (FR-3 과확장): `🔔`/`⤓` 비클릭 span까지 버튼화하면 비목표(알림 동작 추가)에 잠식. → §4에서 클릭 가능 요소만 대상화, Q-4로 경계 확정.
- **R-4** (이름매핑 비용): 클라가 `/api/crews` 별도 호출로 매핑하면 요청 2회. → 서버 조인(Q-1) 선택 시 1회로 단축 가능, architect 권고.

---

## 10. Repository Artifacts 갱신 대상

- **CONTEXT.md (도메인 용어집)**: 다음 용어 추가/보강 필요.
  - **마스터 수정요청 컨펌** (신규): "마스터가 전체 크루의 `EditRequest`를 `GET /api/master/requests`(마스터 게이트)로 조회하고 `POST /api/attendance/requests/approve`로 수락하는 경로. 크루는 본인 요청만 조회(403 격리)."
  - **홈 토글 스코프** (보강): §"crewId 스코프"/"현재 사용자 컨텍스트"에 "`ClockToggle`도 `authHeaders` + `crewId` 의존성으로 본인 스코프 강제(FR-1 이전 누수 교정)" 1줄 추가.
  - **아이콘 버튼 규격** (신규, §"데이터 표기 규칙(UI)"): "아이콘 전용(텍스트 없는) 클릭 버튼의 터치 타겟은 32×32(`h-8 w-8` + 중앙정렬)로 통일."
- **docs/adr/**: **결정 2건 이상** → ADR 1개 작성 권장.
  - 결정① FR-2 마스터 요청 조회를 **신규 라우트(`/api/master/requests`) vs 기존 `/api/attendance/requests` 마스터 분기 재사용** 중 무엇으로 할지(Q-1과 연동).
  - 결정② 크루 이름 매핑을 **서버 조인 vs 클라 `/api/crews` 조인** 중 무엇으로 할지(R-4).
  - → `docs/adr/0005-master-edit-request-confirm.md` 권장.
- **운영 메타 (.task-orchestrator.yml)**: 변경 없음(protected_files/검증강도 오버라이드 불필요).

---

## 📌 Unresolved Questions (승인자 판단 위임)

- **Q-1 (FR-2 UI/API 위치)** — 마스터 수정요청 컨펌을 **(a) `/master`에 "수정요청 컨펌" 섹션 추가** vs **(b) 별도 라우트(예 `/master/requests`)** 중 무엇으로?
  - planner 권고: **(a) `/master` 섹션**. 마스터 진입점이 이미 `/master` 하나로 단일화되어 있고(MyPageView 링크·BottomNav 마스터 탭), 별도 라우트는 네비게이션/가드 중복 비용 발생. 집계뷰 아래 섹션으로 추가가 최소 변경. (단 요청 수가 많아질 도메인이면 (b)가 확장적 — architect/사용자 판단.)
  - 연동: API도 (a)면 신규 `GET /api/master/requests` 1개로 충분.
- **Q-2 (FR-1 구현 형태)** — `ClockToggle` 최소 수정(authHeaders 직접 부착) vs `useDayAttendance` 훅으로 이관(중복 제거, 단 PATCH body 시그니처 차이 흡수 필요). planner 권고: **최소 수정**(회귀 위험 최소). architect가 훅 확장으로 DRY를 택할 수 있음.
- **Q-3 (FR-3 공용 컴포넌트)** — 12개 버튼 className을 in-place 교체할지, `IconButton` 공용 컴포넌트를 신설할지. planner 권고: 신설 시 회귀 표면이 넓어지므로 **in-place 통일**(또는 공용 className 상수). 단 향후 재사용 빈도 고려는 architect 위임.
- **Q-4 (FR-3 범위 경계)** — 현재 클릭 동작이 없는 `🔔`(홈/마이페이지)·`⤓`(캘린더 다운로드) span을 32×32 대상에 포함할지. planner 권고: **현행 비클릭 span은 제외**(클릭 동작 추가는 비목표). 사용자가 "🔔/⤓도 버튼"으로 의도했다면 동작 정의가 별도 필요 → 본 task 범위 밖으로 분리 권장. **AC-7/AC-10/AC-12의 측정 개수는 Q-4 결정 후 확정**(현 baseline 12개).

---

## ✅ Definition of Done

- [ ] S1~S5 산출물 구현 완료, feature-based·append-only 준수.
- [ ] AC-1 ~ AC-12 전부 충족(검증 가능 근거 첨부).
- [ ] AC-R1 ~ AC-R5 회귀 방지 충족 — 기존 **186 테스트 통과** + 신규 FR-1/FR-2 테스트 추가.
- [ ] 엣지 E-1 ~ E-6 처리·검증.
- [ ] 권한 경계(크루 본인 / 마스터 전체) 유지, 마스터 게이트 403 이중 방어.
- [ ] 하이드레이션 mismatch 0(mount-gate 패턴 준수).
- [ ] §10 Repository Artifacts(CONTEXT.md 용어 3건, ADR 0005) 갱신.
- [ ] Unresolved Q-1~Q-4 승인 게이트에서 확정 → AC 측정 개수 fix.
- [ ] reviewer 검증 통과.
