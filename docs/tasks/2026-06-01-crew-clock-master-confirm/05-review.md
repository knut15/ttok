# 리뷰 보고서 (v1)

- **Task**: 2026-06-01-crew-clock-master-confirm
- **검증자**: task-reviewer
- **날짜**: 2026-06-01
- **최신 커밋**: 68f150d / diff base: 7345dd4

---

## AC 매트릭스

| AC# | 내용 | 충족 증거 | 증거 유형 | 일치 |
|---|---|---|---|---|
| **AC-1** | PATCH에 `x-crew-id: crew-2` 헤더 전송, crew-2 레코드에만 clockIn 기록 | `ClockToggle.tsx:54-58` — `headers: { "Content-Type": ..., ...authHeaders(user) }` + `route.test.ts:143-177` 격리 통합테스트 | file:line + test ID | ✅ |
| **AC-2** | 크루A 전환 시 ClockToggle이 `phase==="before"`로 렌더(타 크루 미노출) | `ClockToggle.tsx:26-44` — effect dep `[date, crewId]`로 scope 변경 시 재fetch + `GET headers: authHeaders(user)` → 404→phase before | file:line | ✅ |
| **AC-3** | 전환 시 setRecord(null) 동기 리셋 + active cleanup | `ClockToggle.tsx:29-30` — `setRecord(null)` effect 진입 즉시 동기 실행. `return () => { active = false }` active cleanup | file:line | ✅ |
| **AC-4** | crew-2 PATCH 후 crew-3 GET → 404(격리) | `route.test.ts:143-177` — "크루A 출근 토글은 본인(crew-2) 레코드에만 기록되고 크루B(crew-3)에는 미반영된다" | test ID | ✅ |
| **AC-5** | 마스터 GET /api/master/requests → 두 크루 요청 모두 200 포함 | `master/requests/route.test.ts:17-43` — 2건 addRequest(crew-2, crew-3) 후 마스터 GET → `body.requests.length===2` + crewId 양쪽 포함 | test ID | ✅ |
| **AC-6** | 마스터 화면 각 행에 crewName 표시 | `route.ts:22-25` 서버 조인(`listCrews()` Map) + `route.test.ts:40-42` `row2.crewName` truthy + not "crew-2" + `MasterRequestList.tsx:31` `{req.crewName}` | file:line + test ID | ✅ |
| **AC-7** | 수락 버튼 → POST /api/attendance/requests/approve → 대기→수락 전이 + reload | `useMasterRequests.ts:39-47` — `POST .../approve {id}` + `setReloadKey(k+1)`. `MasterRequestList.tsx:35-47` — `StatusBadge` 수락/대기 + 대기만 수락 버튼 노출(E-3). `approveRequest(store.ts:315-391)` 대기→수락 전이 | file:line | ✅ |
| **AC-8** | 크루 GET /api/master/requests → 403 | `route.ts:13-19` 마스터 게이트. `route.test.ts:46-49` crew 역할 403. `route.test.ts:51-55` 헤더부재 403. UI: `MasterView.tsx:39-52` 크루면 redirect + loading guard | file:line + test ID | ✅ |
| **AC-9** | 크루 본인 스코프 불변(AttendanceDetail/useEditRequests) | `GET /api/attendance/requests` 무변경. `scope.ts:26-28` enforceReadScope 크루 강제. T10 diff에서 해당 route 무변경 | file:line | ✅ |
| **AC-10** | §4 확정 12개 버튼 모두 `h-8 w-8` + 중앙정렬 | grep 결과: AttendanceCalendarView.tsx:40,52 / PayView.tsx:39,51 / MasterView.tsx:63,72 / MasterCrewDetail.tsx:78,87 / AttendanceDetailNav.tsx:21,34,42 / BackButton.tsx:13 = 12개 `grid h-8 w-8 place-items-center` | file:line (12건) | ✅ |
| **AC-11** | 텍스트 버튼(급여명세서/수락/MonthSelector) 스타일 불변 | PayView.tsx:59 `rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold` 불변. MasterRequestList.tsx:43 `rounded-lg bg-coral px-3 py-1.5` 텍스트 수락버튼 신규(적절). ⤓/🔔 span T10 diff 변경 없음 | file:line | ✅ |
| **AC-12** | grep §4 대상 누락 0, 적용 12개 일치 | 상기 grep 카운트 = AttendanceCalendarView(2) + PayView(2) + MasterView(2) + MasterCrewDetail(2) + AttendanceDetailNav(3) + BackButton(1) = 12. ProfileForm(이미 32×32) 기존 유지 | file:line (grep) | ✅ |

### 회귀 방지 (R1~R5)

| AC# | 내용 | 충족 증거 | 증거 유형 | 일치 |
|---|---|---|---|---|
| **AC-R1** | 기존 186 테스트 전부 통과 | `pnpm test` 191/191 passed (0 failed). 기존 186 + 신규 5건 | test ID (DoD 실행) | ✅ |
| **AC-R2** | 크루 본인 스코프 유지(enforceReadScope) | `scope.ts:26-28` 무변경. `route.test.ts:56-64` 크루 ?crewId 무시 테스트 GREEN | file:line + test ID | ✅ |
| **AC-R3** | 마스터 게이트 유지(approve + 신규 requests) | `approve/route.ts:11-16` role≠master→403. `master/requests/route.ts:13-19` role≠master→403 | file:line | ✅ |
| **AC-R4** | 김민정 폴백 보존 | `scope.ts:17` 헤더부재 DEFAULT_CREW_ID. `route.test.ts:173-177` 헤더부재 GET → crew-2 기록 미반영 | file:line + test ID | ✅ |
| **AC-R5** | 하이드레이션 안전(mount-gate) | `ClockToggle.tsx` = HomeToday mount-gate 하위 동작. `MasterView.tsx:23-27` useSyncExternalStore mount gate + `39-52` role 미확정 시 loading guard | file:line | ✅ |

### 발견된 프로젝트 자원 검증

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Proj-1 | 컨벤션 준수(CLAUDE.md/eslint) | `eslint` 0 errors. `tsc --noEmit` exit 0 | ✅ |
| AC-Proj-2 | PRD §3 명시 자원 활용 | `api/master/crews` 게이트 패턴 복제, `listRequests/listCrews/approveRequest` 재사용(store 신규함수 0), `useAttendance/useMasterSummary` 훅 패턴, `eslint set-state-in-effect` 컨벤션 — 모두 활용 흔적 확인 | ✅ |
| AC-Proj-3 | project_skills 적합 스킬 활용 | FR-2 수락이 기존 approve API 재사용 — 중복 구현 없음 | ✅ |

### Repository Artifacts 검증

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Repo-1 | CONTEXT.md 용어 3건 갱신 | "마스터 수정요청 컨펌" + "홈 토글 스코프" + "아이콘 버튼 규격"(데이터 표기 규칙 UI) 확인 | ✅ |
| AC-Repo-2 | ADR 0006 작성 | `docs/adr/0006-master-edit-request-confirm.md` 존재. 결정①신규라우트 + 결정②서버조인 기록 | ✅ |
| AC-Repo-3 | 갱신 시점 적절성 | 커밋 68f150d 단일 커밋에 코드+Artifacts 함께 포함 | ✅ |

### 프로젝트 구조 준수 검증

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Struct-1 | 신규 파일 배치 | `api/master/requests/route.ts` = PRD §3 지정 경로. `features/accounts/hooks/useMasterRequests.ts` + `features/accounts/components/MasterRequestList.tsx` = PRD §3 + architect §1 경로 | ✅ |
| AC-Struct-2 | 폴더 책임 침범 없음 | client hooks → route 경유(store 직접 import 없음). types/index.ts append-only | ✅ |
| AC-Struct-3 | append-only 원칙 | 기존 파일 in-place 수정(ClockToggle/MasterView/FR-3 대상), 신규 파일 추가. 삭제 없음 | ✅ |

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 17개 (AC-1~12 + R1~R5)
- file:line 증거: 15개
- test ID 증거: 7개 (복수 AC가 두 유형 모두 보유)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 17/17 = **100%**

---

## 경계면 검증

### store listRequests() ↔ route MasterRequestRow[] ↔ hook MasterRequestsResponse ↔ MasterRequestList props

- `store.ts:261` `listRequests(): EditRequest[]` — crewId 생략=전체 최신순
- `route.ts:23-26` `EditRequest` + `crewName` 필드 append → `MasterRequestRow` (types/index.ts:169-171 `extends EditRequest { crewName: string }`)
- `useMasterRequests.ts:24-32` fetch `/api/master/requests` → `MasterRequestsResponse` 타입 명시 (types/index.ts:174-176)
- `MasterRequestList.tsx:8-14` props `{ requests: MasterRequestRow[]; onApprove: (id:string)=>void }` — types만 의존, store 비접근
- **일치**: `tsc --noEmit` exit 0로 shape 전 계층 일치 확인

### GET /api/attendance (crewId scope) ↔ ClockToggle (authHeaders)

- `ClockToggle.tsx:31-35` GET에 `headers: authHeaders(user)` → 서버 `readScope(req).crewId` = `user.crewId ?? user.id`
- `scope.ts:15-19` `readScope` 헤더 부재→DEFAULT_CREW_ID(김민정 폴백 보존)
- `scope.ts:26-28` `enforceReadScope` 크루→본인 강제. URL/body 불변 → 기존 route 테스트 회귀 0
- **일치**: route.test.ts L143-177 격리 통합테스트 GREEN

### approve 계약 재사용 확인

- `useMasterRequests.ts:41-44` `POST /api/attendance/requests/approve` `{ id }` → 기존 approve/route.ts L11-37 계약 동일
- `approve/route.ts` T10에서 무변경 — 마스터 게이트(role≠master→403) 보존
- **일치**: 기존 approve 테스트 포함 191/191 GREEN

### MasterView mount-gate ↔ useMasterRequests dep

- `MasterView.tsx:23-52` mounted gate + role 확인 후 컴포넌트 렌더
- `useMasterRequests.ts:22-37` effect dep `[crewId, user.role, reloadKey]` — role 변경 시 재fetch
- 크루가 `/master` 진입 시 가드에서 redirect, useMasterRequests는 마스터 가드 하위에서만 실질 실행
- **일치**: 하이드레이션 mismatch 0 (useSyncExternalStore mount gate 패턴)

---

## 빌드/테스트 결과

| 항목 | 결과 | 상세 |
|---|---|---|
| 빌드 (`pnpm build`) | ✅ | `/api/master/requests` 라우트 포함 전 라우트 정상 컴파일 |
| 타입체크 (`tsc --noEmit`) | ✅ | exit 0, 출력 없음 |
| 단위/통합 테스트 (`pnpm test`) | ✅ | **191/191 passed** (22 test files, 0 failed) |
| Lint (`pnpm lint`) | ✅ | 0 errors |

기존 186 테스트 회귀: **0건**. 신규 5건 추가(FR-1 격리 1건 + FR-2 마스터 조회 4건).

---

## 권한 경계 검증

### 크루 격리 (FR-1)

- `ClockToggle.tsx` GET/PATCH 양방향에 `authHeaders(user)` 부착(L31-35, L54-58) — 이전 헤더 누락 버그 교정 확인
- effect dep `[date, crewId]` (L44) — 계정 전환 시 이전 크루 레코드 즉시 무효화
- `setRecord(null)` (L30) 동기 리셋 — stale 1프레임 노출 금지
- active cleanup (`return () => { active = false }`) — 전환 중 stale 응답 UI 반영 차단 (GET 한정)
- 통합테스트 GREEN: crew-2 PATCH → crew-2 반영 / crew-3 미반영 / 헤더부재(김민정) 미반영

### 마스터 게이트

- `GET /api/master/requests` — `readScope(req).role !== "master"` → 403 (route.ts:13-19)
- `POST /api/attendance/requests/approve` — 동일 패턴, T10에서 무변경
- UI 이중 방어: `MasterView.tsx` role≠master 시 redirect (`router.replace("/")`)
- 테스트: crew 역할 403 + 헤더부재 403 + 빈배열 200 모두 GREEN

---

## 🤝 교차 검증 (codex review)

- 자체 판정: PASS (하네스축)
- codex 판정: P2 2건 (P1 없음 → 비차단)
- 호출 시각: 2026-06-01T02:18:42Z
- 모델: gpt-5.5 (codex 0.135.0)
- gate_mode: and (P2는 차단 아님, P1 없음 → codex 코드축 PASS)

**codex 지적 (P2 — 비차단):**

1. **[P2] ClockToggle.tsx:30 — 로딩 중 클릭 비활성화 누락**
   계정 전환 후 `setRecord(null)` 리셋으로 phase=before가 되어 GET 완료 전에 출근 버튼이 일시 활성화. 그 사이 클릭 시 기존 clockIn을 덮어쓸 수 있음. `loading` 상태를 추가하여 fetch 완료 전 버튼을 비활성화하거나 숨길 것을 권고.

2. **[P2] ClockToggle.tsx:54-59 — stale PATCH 응답 처리 누락**
   PATCH 요청 중 계정 전환 시 늦게 도착한 응답이 `setRecord`를 호출하여 새 크루 레코드를 이전 크루 상태로 오염시킬 수 있음. PATCH 시점의 crewId를 캡처하거나 abort/ignore 처리 권고.

- 최종 결정: **PASS 확정** (P2만 있음 — 비차단, follow-up P2로 등록)

**codex 평가:**
두 지적 모두 극단적 타이밍 조건(GET 미완료 시점에 클릭, PATCH 미완료 시점에 전환)에서 발생하는 race condition이다. 현재 구현은 GET에 대해 active cleanup이 있어 stale GET 반영을 막지만, (1) 로딩 중 버튼 활성화, (2) PATCH stale setRecord는 미처리다. 두 케이스 모두 mock 인메모리 스토어 환경에서 전환이 매우 빠른 경우에만 재현되며 AC-3(active cleanup)의 핵심 경로(GET stale 차단)는 달성되어 있다. P1 수준의 데이터 누수(헤더 부재로 타 크루에 기록)는 해소됨. follow-up으로 처리 타당.

---

## 회귀 검증 요약

| 항목 | 결과 |
|---|---|
| 기존 186 테스트 | ✅ 전부 GREEN (회귀 0) |
| 크루 본인 스코프(enforceReadScope) | ✅ scope.ts 무변경, route.test.ts L56-64 GREEN |
| 마스터 게이트(approve 403) | ✅ approve/route.ts 무변경 |
| 김민정 폴백 | ✅ scope.ts L17 DEFAULT_CREW_ID, route.test.ts L173-177 GREEN |
| mount-gate/하이드레이션 | ✅ useSyncExternalStore 패턴 ClockToggle·MasterView 모두 적용 |
| ClockToggle URL/body 불변 | ✅ GET `/api/attendance/${date}` + PATCH `/api/attendance?date=${date}` 동일, `{field, time}` body 불변 |

---

## 최종 판정

**판정: PASS**

**사유:**
- AC-1~12 전부 충족. AC-R1~R5 전부 충족. 정량 증거 100% (file:line + test ID).
- 빌드/타입체크/린트/테스트(191/191) 전부 PASS.
- 권한 경계(크루 격리·마스터 게이트) 이중 방어 확인 — API 게이트 + UI 가드.
- codex 교차검증 P1 없음 → 코드축 PASS.
- Repository Artifacts(CONTEXT.md 3건 + ADR 0006) 갱신 확인.

**회귀 지점:** 없음 (종료 — Done)

---

## Follow-up (P2, 별도 task 권장)

| # | 항목 | 분류 | 내용 |
|---|---|---|---|
| F-1 | ClockToggle 로딩 중 버튼 비활성화 | P2 | `loading` 상태 추가, GET 완료 전 출근/퇴근 버튼 `disabled` 처리. 현재 `busy` 상태가 PATCH 중에만 비활성화 — GET 중 비활성화 미적용 |
| F-2 | ClockToggle PATCH stale 응답 차단 | P2 | PATCH 요청 시 현재 crewId 캡처, 응답 도착 시 crewId 불일치면 `setRecord` 무시 (또는 AbortController 활용). GET의 active cleanup 패턴을 PATCH에도 적용 |
