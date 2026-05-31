# 📋 PRD (v1) — 계정/권한 분리: 마스터·크루 (T8)

> 작성: task-planner / 2026-05-31 / mode: teammate (Notion 미사용, 로컬 산출물)
> 대상: 기존 Crewmon 출퇴근·급여 데모 앱의 **대규모 확장**(계정/권한 분리)
> 참조 디자인: `public/sample/IMG_3616.png`(마이페이지·나의 매장), `IMG_3617.png`(알림)

---

## 0. 한 줄 요약

단일 사용자(김민정) 무인증 인메모리 데모에 **mock 역할 전환 기반 계정/권한 분리**를 도입한다. 마스터(점주)는 전체 크루의 근무/휴일을 집계 조회하고 수정요청을 수락하며, 크루는 초대로만 합류하고 본인 데이터만 조회한다. 실제 로그인·DB 없이 클라이언트 역할 전환 + crewId 스코프로 구현하며 **기존 138 테스트 회귀 0**을 보장한다.

---

## 1. 배경 / 문제

### 1.1 현재 상태 (정독 결과)
- store(`src/lib/store.ts`)는 **단일 사용자 전제**: `records: Map<"YYYY-MM-DD", AttendanceRecord>` 하나, `requests: EditRequest[]` 하나, `profile`/`storeInfo` 단일. 김민정 한 명의 데이터만 존재.
- 모든 store 함수가 사용자 식별자 없이 동작: `getMonthRecords(month)`, `getRecord(date)`, `updateStatus(date,status)`, `upsertTodayClock(date,field,time)`, `listRequests()`, `addRequest(req)`, `approveRequest(id)`, `getProfile()`, `updateProfile(patch)`.
- API(`src/app/api/**`)는 month/date/id만 받음. 호출자(누구든) 구분 없음.
- **수락은 누구나 가능**: `EditRequestList`(`src/features/attendance/components/EditRequestList.tsx`)의 '수락' 버튼은 `onApprove` prop만 있으면 표시되고, `AttendanceDetail`이 무조건 배선 → 권한 게이트 없음. `POST /api/attendance/requests/approve`도 호출자 검증 없음.
- `MyPageView`는 김민정 고정. `BottomNav`는 홈/출퇴근/급여/마이페이지 4탭 고정.

### 1.2 요구 (사용자 결정 확정)
1. **마스터는 모든 크루의 근무시간/휴일을 본다** — 마스터 전용 집계 뷰(크루 목록 + 각자 근무/휴일).
2. **크루는 초대를 통해서만 멤버가 된다** — 초대 코드/링크 mock 플로우(마스터 생성, 크루 코드 합류).
3. **각 크루는 본인 스케줄만 본다** — 크루 로그인 시 본인 데이터로 스코프(출퇴근/급여/캘린더 모두 본인 것만).
4. **변경건 컨펌(수락)은 마스터만** — 현재 누구나 가능한 수락을 **마스터 역할만** 가능하도록 제한. 크루는 수정요청 생성만.

### 1.3 사용자 결정 (방식 — 확정)
- **인증 = 데모 역할 전환(mock)**: 실제 로그인/비밀번호 없음. mock 계정(마스터 1 + 크루 2~3) + **현재 사용자/역할 전환 UI**. 세션은 클라 상태 + localStorage 수준.
- **멀티 크루 데이터**: 김민정 포함 크루 2~3명 mock 시드(각자 근무기록·스케줄). 마스터 1명(점주).
- **전체 범위**: 역할 + 권한 + 초대 + 마스터뷰 모두 이번 task.

---

## 2. 목표 / 비목표

### 2.1 목표 (이번 task)
- mock 다중 계정(마스터 1 + 크루 3) + crewId별 근무기록 시드.
- 클라이언트 "현재 사용자/역할" 컨텍스트 + 역할 전환 UI.
- store/API 전반에 **crewId 스코프** 도입(append-only 시그니처 전략, 회귀 0).
- 크루 본인-스코프(홈/출퇴근/급여/마이페이지가 현재 사용자 데이터만).
- 마스터 전용 집계 뷰(전체 크루 목록 + 각자 근무/휴일 요약).
- 초대 코드 생성(마스터) + 코드 합류(크루) mock 플로우.
- 수락(approve)을 **마스터 역할만**으로 제한(API 403 + UI 게이트 양쪽).

### 2.2 비목표 (Out of Scope)
- 실제 인증(로그인/비밀번호/세션 토큰/OAuth). **명시 제외** — mock 역할 전환만.
- 영속 DB / 서버 재시작 시 데이터 보존. 인메모리 휘발성 현행 유지(ADR 0001).
- 초대 만료/회수/재발급, 초대 이메일·SMS 실발송. 코드 검증·합류 mock까지만.
- 매장 다중화("매장 등록하기" 실동작). 단일 매장 전제(IMG_3616 매장 1개).
- 크루 삭제/탈퇴, 권한 세분화(매니저 등 제3역할). 역할은 `master`/`crew` 2종.
- 알림 기능 실구현(IMG_3617). 본 PRD에서는 참조 화면일 뿐 신규 구현 대상 아님.
- 비밀번호 정책, 감사 로그, 동시성 제어.
- `pay` summary 불변식(차감 440 / 연장 6·544 / 주휴 67,080)의 변경. **김민정 시드는 불변**으로 보존(§7 회귀).

---

## 3. 솔루션 개요

mock 역할 전환을 클라이언트 컨텍스트로 두고, store를 **crewId 스코프**로 확장한다. API는 mock이므로 crewId/role을 **쿼리 파라미터 또는 헤더**로 받아 스코프·권한을 결정한다.

핵심은 **append-only 시그니처 전략으로 기존 138 테스트 회귀 0**을 지키는 것이다. 기존 store 함수가 crewId 없이 호출되면 **기본 crewId(김민정 = `crew-minjung`)로 fallback** 하여 단일 사용자 흐름이 그대로 보존되도록 한다(아래 §3.2).

### 3.1 데이터 모델 (가장 큰 회귀면 — store 스코프 전략)

현재 `StoreShape`:
```
records: Map<"YYYY-MM-DD", AttendanceRecord>   // 단일 사용자
requests: EditRequest[]                         // 단일
profile / storeInfo                             // 단일
```

확장 후(제안 — architect가 §2.5에서 확정):
```
crews: Crew[]                                    // 마스터 1 + 크루 3 (id, name, role, avatarInitial, joinDate, active)
recordsByCrew: Map<crewId, Map<"YYYY-MM-DD", AttendanceRecord>>
requests: EditRequest[]                          // 각 EditRequest 에 crewId 태그 추가 (append)
invites: Invite[]                                // code, createdBy(masterId), targetCrewId?, status, createdAt
profilesByCrew: Map<crewId, UserProfile>
storeInfo                                        // 단일 매장 유지
currentUserId                                    // (선택) 서버 기본값 — 실제 현재 사용자는 클라가 결정
```

**스코프 전략 — 2가지 후보(Unresolved Q-A에서 승인자 확인):**
- **(전략 A) crewId 인자 추가 + 기본값 fallback** (권장): `getMonthRecords(month, crewId = DEFAULT_CREW_ID)` 처럼 **선택적 인자를 뒤에 append**. 기존 호출(`getMonthRecords(month)`)은 인자 생략 → 김민정 데이터 → 138 테스트 불변. 신규 호출만 crewId 명시.
- **(전략 B) 명시적 마이그레이션**: 모든 호출부를 crewId 명시로 교체. 회귀면 큼(테스트 다수 수정). 비권장.

> **planner 권장: 전략 A.** `EditRequest`에 `crewId?: string`(optional append)을 더하고, store 내부는 `recordsByCrew.get(crewId ?? DEFAULT_CREW_ID)`로 흡수. ADR 0004가 `breakStart?`/`breakEnd?` optional append로 122→회귀 0을 달성한 선례와 동일 전략. 단, `recordsByCrew` 구조 자체는 내부 표현 변경이므로 store 단위 테스트 일부는 보정이 필요할 수 있음 → §7 회귀 AC로 강제.

### 3.2 현재 사용자 / 역할 컨텍스트
- 신규 타입 `User { id, name, role: "master" | "crew", avatarInitial, crewId? }` (crewId는 crew일 때 본인 식별).
- 클라이언트 컨텍스트(예 `useCurrentUser` 훅 + React Context 또는 localStorage): 현재 사용자/역할 보유. 새로고침 후에도 localStorage로 복원.
- API 호출 시 클라가 `?crewId=`/`?role=` 쿼리 또는 `x-crew-id`/`x-role` 헤더로 현재 사용자 전달(Unresolved Q-D).
- 서버는 mock 신뢰 모델 — 헤더/쿼리 값을 그대로 신뢰(실제 인증 아님, 명시 제약).

### 3.3 권한 게이트
- **크루**: 본인 crewId 데이터만 조회·생성. 타 crewId 요청 시 본인 것만 반환(또는 403, Q-C).
- **마스터**: 전체 크루 조회 가능. 수락(approve) 가능.
- **수락 게이트(요구 4)**: `role === "master"`만. 크루의 수락 시도는 **API 403 + UI 버튼 숨김** 양쪽 게이트.

### 3.4 초대 플로우 (mock)
- 마스터: "초대 생성" → `Invite { code, status: "대기" }` 발급. 코드 표시(복사용 mock 링크).
- 크루: "코드로 합류" 입력 → 코드 검증 → 매칭되면 해당 크루 계정 `active = true`, 합류 처리.
- 잘못된 코드 → 명시적 에러. 이미 사용된 코드 → 거부(Q-C2).

### 3.5 UI
- **역할 전환 진입점**: 마이페이지 상단 또는 앱 헤더(Unresolved Q-B). mock 계정 목록에서 선택 → 현재 사용자 전환.
- **마스터 집계 뷰**: 신규 라우트(예 `/master`) 또는 마이페이지 내 섹션(Q-B2). 크루 목록 + 각자 근무시간/휴일 요약.
- **크루 뷰**: 기존 홈/출퇴근/급여/마이페이지가 현재 사용자 스코프로 동작.
- **초대 화면**: 마스터 초대 생성 / 크루 코드 합류.
- **수락 버튼**: `EditRequestList` 수락 버튼을 마스터일 때만 렌더.

### 활용할 프로젝트 자원

> Phase -1 `project_skills` 미제공(teammate, 로컬 스캔). 발견된 자원 = repo 내 컨벤션 문서 + 기존 코드 패턴.

- `CONTEXT.md` (도메인 용어집): 모든 용어·정책의 단일 출처 — 전 phase 기준. 본 task는 §10에서 신규 용어(마스터/크루/초대 등) 추가.
- `docs/adr/0001~0004`: 인메모리 store(0001)·readonly 필드(0002)·연장 산식(0003)·편집 시트/append 전략(0004) 결정 — phase 2.5/3에서 일관성 기준.
  - 특히 **ADR 0004의 append-only 회귀 0 전략**이 본 task §3.1 전략 A의 직접 선례.
- `.task-orchestrator.yml`: mode teammate / artifact_dir `docs/tasks/` / feature-based 패턴 — phase 3 배치 기준.

### 프로젝트 구조 (Phase -0.5 결과 인용)
- 패턴: `feature-based` (+ `nextjs-app-router`)
- 신규 산출물 배치(`.task-orchestrator.yml` ai_suggested_placements):
  - 신규 feature 코드(역할전환·마스터뷰·초대 UI) → `src/features/<name>/` (예 `src/features/accounts/`)
  - 신규 공용 UI → `src/components/`
  - 신규 util/store 확장 → `src/lib/` (store.ts 확장, seed.ts 멀티크루)
  - 신규 API route → `src/app/api/<name>/route.ts` (예 `api/invites`, `api/crews`)
  - 신규 공용 타입(User/Role/Invite/Crew) → `src/types/index.ts` (append)
- 사용자 메모: Crewmon 클론, 코랄/오렌지 테마, 모바일 세로 전용, 바텀 탭 4개.

---

## 4. 사용자 시나리오

1. **마스터 집계**: 점주(마스터)로 전환 → `/master` 진입 → 크루 3명 목록 + 각자 5월 근무시간 합계·휴일 수 표시.
2. **초대→합류**: 마스터가 초대 생성 → 코드 발급 → 크루로 전환 후 코드 입력 → 합류 성공 → 해당 크루 본인 데이터 조회 가능.
3. **본인 스코프**: 크루A로 전환 → 홈/출퇴근/급여 모두 크루A 데이터. 크루B 데이터 안 보임.
4. **수락 권한**: 크루가 수정요청 생성(가능) → 수락 버튼 안 보임. 마스터로 전환 → 수락 버튼 보임 → 수락 → 반영.

---

## 5. 기능 요구 + Acceptance Criteria

> AC는 Given-When-Then. 검증은 단위/통합 테스트(store·API) + 컴포넌트 테스트로 가능해야 함.

### FR-1 mock 계정 + 멀티 크루 시드
- **AC-1**: Given 서버 시드, When store 초기화, Then 마스터 1명 + 크루 3명(김민정 = `crew-minjung` 포함)이 존재한다.
- **AC-2**: Given 멀티 크루 시드, When 김민정(`crew-minjung`)의 5월 레코드를 조회, Then **기존 단일 사용자 시드와 동일**(차감Σ=440, 연장 6회·Σ544, 주휴 67,080 불변).
- **AC-3**: Given 다른 크루(예 `crew-2`), When 5월 레코드 조회, Then 김민정과 **다른** 본인 근무기록(0건 이상)을 반환한다.

### FR-2 현재 사용자 / 역할 컨텍스트 + 전환
- **AC-4**: Given 앱 첫 로드, When 별도 선택 없음, Then 기본 현재 사용자는 김민정(crew)이다(기존 단일사용자 흐름 보존).
- **AC-5**: Given 역할 전환 UI, When 마스터 계정 선택, Then 현재 사용자/역할이 master로 바뀌고 localStorage에 반영된다.
- **AC-6**: Given 마스터로 전환된 상태, When 새로고침, Then 현재 사용자가 master로 복원된다(localStorage).

### FR-3 크루 본인-스코프
- **AC-7**: Given 현재 사용자 = 크루A, When 홈/출퇴근/급여 화면 진입, Then 모든 데이터가 크루A 것만 표시된다(타 크루 데이터 0건).
- **AC-8** (권한 경계): Given 크루A, When 크루B의 crewId로 API 조회 시도, Then 크루A 데이터만 반환 또는 403 — **타 크루 데이터는 절대 노출되지 않는다**(Q-C 확정값 따름).
- **AC-9**: Given 크루A가 수정요청 생성, When `POST /api/attendance/requests`(crewId=크루A), Then 요청이 크루A에 태그되어 생성된다(201).

### FR-4 마스터 집계 뷰
- **AC-10**: Given 현재 사용자 = 마스터, When 마스터 집계 뷰 진입, Then 전체 크루 목록(3명)과 각자 근무시간 합계·휴일 수가 표시된다.
- **AC-11**: Given 마스터 집계 뷰, When 특정 크루 선택, Then 해당 크루의 근무/휴일 상세를 볼 수 있다(읽기).
- **AC-12** (권한 경계): Given 현재 사용자 = 크루, When 마스터 집계 라우트 직접 진입, Then 접근 거부(리다이렉트 또는 빈/차단 화면) — 크루는 전체 집계를 볼 수 없다.

### FR-5 초대 플로우 (mock)
- **AC-13**: Given 마스터, When 초대 생성, Then 고유 코드를 가진 `Invite`(status="대기")가 발급되고 화면에 코드가 표시된다.
- **AC-14**: Given 유효한 미사용 코드, When 크루가 코드로 합류, Then 해당 크루 계정이 active=true가 되고 합류 성공 응답(200/201)을 받는다.
- **AC-15** (권한 경계): Given 크루(비마스터), When 초대 생성 API 호출, Then 403(초대 생성은 마스터만).

### FR-6 수락 마스터 게이트 (요구 4 — 회귀 핵심)
- **AC-16** (UI): Given 현재 사용자 = 크루, When `EditRequestList` 렌더, Then '수락' 버튼이 **표시되지 않는다**.
- **AC-17** (UI): Given 현재 사용자 = 마스터, When `EditRequestList` 렌더(대기 요청 존재), Then '수락' 버튼이 표시된다.
- **AC-18** (API): Given 크루(role=crew), When `POST /api/attendance/requests/approve`, Then **403**(수락 거부) — store 레코드 불변.
- **AC-19** (API): Given 마스터(role=master), When 유효 요청 id로 approve, Then 200 `{request, record}` 반환 + status 대기→수락 전이(기존 approve 동작 보존).

---

## 6. 엣지 케이스 (최소 3 — 능동 발굴)

- **E-1 미초대 크루**: active=false 크루로 전환 시 → 데이터 접근 차단 또는 "초대 코드로 합류하세요" 안내(빈 상태). 크래시 금지.
- **E-2 잘못된 초대 코드**: 존재하지 않는 코드 합류 시 → 명시적 에러(400/404), 합류 안 됨.
- **E-2b 이미 사용된 코드**: status≠"대기" 코드 재사용 → 거부(409/400).
- **E-3 역할 전환 중 데이터**: 마스터↔크루 전환 직후 화면 데이터가 **즉시 새 사용자 스코프로 갱신**되어야 함(이전 사용자 데이터 잔존 금지). 전환 중 로딩 가드.
- **E-4 마스터 본인 근무기록 유무**: 마스터는 근무기록이 없을 수 있음 → 마스터로 출퇴근/급여 진입 시 0건/빈 상태 정상 표시(crash·NaN 금지). 마스터에게 출퇴근 탭 노출 정책은 Q-B3.
- **E-5 크루 0명 마스터뷰**: 크루가 한 명도 없을 때(이론적) 마스터 집계 뷰 → "등록된 크루 없음" 빈 상태. 0으로 나누는 평균 계산 금지.
- **E-6 대량 데이터**: 크루 N명 × 월 레코드 → 마스터 집계가 O(N×days) 합산. mock 규모(3명)에선 무해하나, 합산 함수는 빈 배열·결측 방어.
- **E-7 권한 우회 시도**: 크루가 헤더/쿼리를 임의 master로 위조 → mock 신뢰 모델이라 막지 않음(명시 제약, 비목표). 단, 정상 클라 경로에서 크루 UI에 수락/마스터뷰 진입점이 없어야 함.

---

## 7. 회귀 방지 (필수 — 기존 138 테스트 + 단일사용자 흐름)

- **AC-R1**: 기존 **138개 테스트가 모두 통과**한다(수정 불가피한 store 내부 표현 변경 테스트는 시그니처/계약 동등성을 유지하며 최소 보정, 신규 케이스로 대체 금지).
- **AC-R2**: 단일 사용자 흐름(crewId 미지정 호출)이 **김민정(`crew-minjung`) 기본**으로 동작한다 — `getMonthRecords(month)`, `getRecord(date)` 등 인자 생략 시 김민정 데이터.
- **AC-R3**: 김민정 5월 시드 불변식 보존 — 차감Σ=440 / 연장 6회·Σ544분 / `totalPay = Σ items.amount`(주휴 67,080 포함). `seed.test.ts` 통과.
- **AC-R4**: `breakStart`/`breakEnd` 파생, 연장 산식(ADR 0003), 휴게 범위(ADR 0004) 동작 불변.
- **AC-R5**: 마스터 게이트 도입 후에도 마스터 경로의 approve 결과가 기존 `approveRequest` 동작과 동일(멱등·upsert·결근/휴가 정책 보존).

---

## 8. 메트릭 (성공 판정 정량 지표)

- **M-1 회귀율 0%**: 전체 테스트 통과율 = 100%(기존 138 + 신규). 빌드·타입체크 0 error.
- **M-2 권한 격리 100%**: 권한 경계 AC(AC-8/12/15/16/18) **전부 통과** — 크루의 타 크루 데이터 노출 0건, 크루 수락 시도 차단율 100%.
- **M-3 신규 AC 커버리지**: FR-1~6 신규 AC(AC-1~19) 각각 최소 1개 자동 테스트로 검증.

---

## 9. 의존성 / 리스크

### 9.1 의존성
- 선행 task 없음(기존 코드 위 확장). 외부 API 없음(전부 인메모리 mock).
- ADR 0001(인메모리), 0004(append-only 전략)에 의존 — 동일 원칙 계승.

### 9.2 리스크
- **R-1 (높음) store 시그니처 회귀**: 거의 모든 store 함수가 crewId 스코프를 받음. 전략 A(기본값 fallback)로 완화하되, `recordsByCrew` 내부 구조 변경이 `store.test.ts`를 건드릴 수 있음 → §7 AC-R1로 강제, architect가 §2.5에서 최소 보정 범위 확정.
- **R-2 (중) 역할 전환 상태 일관성**: 전환 시 진행 중 fetch가 이전 사용자 데이터로 늦게 도착 → E-3 로딩 가드 + crewId 키 기반 무효화 필요.
- **R-3 (중) mock 권한의 가짜 안전감**: 헤더 위조 방어 안 함(비목표). PRD·코드 주석에 "mock 신뢰 모델, 실보안 아님" 명시 필요.
- **R-4 (낮) UI 범위 팽창**: 마스터뷰·초대·전환 UI 3종 신규 화면. sub-task vertical slice로 분할(§1.5)하여 통합 리스크 관리.

---

## 1.5 Sub-task 분해 (vertical slice, 8개 — 범위 大)

> 각 슬라이스는 독립 검증 가능(테스트 동반). 순서는 데이터 → 컨텍스트 → 스코프 → 화면 → 통합.

| # | Sub-task | 핵심 산출물 | 검증(AC) | 사용 가능한 자원 |
|---|---|---|---|---|
| T8-1 | User/Role/Invite/Crew 타입 + 멀티크루 시드 | `src/types/index.ts`(append), `src/lib/seed.ts`(멀티크루), 상수 | AC-1, AC-2, AC-3 | CONTEXT.md, seed.test.ts 패턴 |
| T8-2 | store 멀티크루 스코프 리팩토링 + 테스트 | `src/lib/store.ts`(recordsByCrew, crewId fallback) | AC-2, AC-R1~R5 | ADR 0004 append 전략 |
| T8-3 | 현재 사용자 컨텍스트 + 역할 전환 UI | `src/features/accounts/`(Context/훅), 전환 진입점 | AC-4, AC-5, AC-6, E-3 | feature-based 패턴, localStorage |
| T8-4 | 크루 본인-스코프 적용(기존 화면 + API) | API crewId 전달, hooks 갱신 | AC-7, AC-8, AC-9 | useAttendance/usePay 훅 |
| T8-5 | 마스터 집계 뷰 | `/master` 라우트 또는 마이페이지 섹션, 집계 컴포넌트 | AC-10, AC-11, AC-12, E-4, E-5 | IMG_3616 레이아웃, components/ |
| T8-6 | 초대 플로우(생성/합류 mock) | `api/invites` route, 초대 UI | AC-13, AC-14, AC-15, E-1, E-2, E-2b | Route Handler 패턴 |
| T8-7 | 수락 마스터 게이트(API + UI) | approve route 403 게이트, `EditRequestList` 버튼 게이트 | AC-16, AC-17, AC-18, AC-19, AC-R5 | EditRequestList, approve route |
| T8-8 | 통합 · DoD · 회귀 스위프 | 전 화면 E2E mock 흐름, 회귀 점검 | AC-R1~R5, M-1, M-2, M-3 | 전체 test suite |

---

## 11. Definition of Done (DoD)

- [ ] §5 신규 AC(AC-1~19) 전부 자동 테스트로 검증·통과.
- [ ] §7 회귀 AC(AC-R1~R5) 통과 — 기존 138 테스트 + 김민정 시드 불변식 보존.
- [ ] §6 엣지(E-1~E-7) 처리 또는 명시적 결정 반영.
- [ ] §8 메트릭(M-1 회귀 0% / M-2 권한격리 100% / M-3 커버리지) 충족.
- [ ] `npm run build` / 타입체크 0 error.
- [ ] §10 Repository Artifacts(CONTEXT.md 용어 추가, ADR) 갱신 완료.
- [ ] Unresolved Q(A~D) 승인 단계에서 결정·반영.

---

## 12. 📌 Unresolved Questions (승인자 판단 위임)

> 본 task는 대규모 확장이라 설계 분기점이 많다. 승인 게이트에서 아래를 확정해 architect로 넘긴다.

- **Q-A (store 스코프 전략)**: 전략 A(crewId 인자 append + 기본값 fallback, planner 권장) vs 전략 B(전면 마이그레이션). 회귀면·테스트 보정량 차이.
- **Q-B (UI 배치)**:
  - **Q-B1**: 역할 전환 진입점 위치 — 앱 헤더(전역) vs 마이페이지 상단(IMG_3616 "내 정보 수정" 근처).
  - **Q-B2**: 마스터 집계 뷰 — 신규 라우트 `/master`(+ 바텀탭/진입점) vs 마이페이지 내 섹션.
  - **Q-B3**: 마스터에게 출퇴근/급여 탭을 보일지(마스터는 본인 근무기록 없음 — E-4). 숨김 vs 빈 상태 노출.
- **Q-C (권한 경계 처리 방식)**:
  - **Q-C1**: 크루가 타 crewId 조회 시도 → **403 차단** vs **본인 데이터로 강제 스코프**(타 crewId 무시). 어느 쪽을 캐논으로?
  - **Q-C2**: 이미 사용된/만료 초대 코드 재사용 → 거부 코드(409 vs 400) 및 메시지.
- **Q-D (현재 사용자 전달 방식)**: API에 crewId/role을 **쿼리 파라미터**(`?crewId=&role=`) vs **요청 헤더**(`x-crew-id`/`x-role`)로 전달. 캐싱·테스트 용이성·기존 fetch 훅 영향 고려.
- **Q-E (크루 인원/시드 구체값)**: 크루 2명 vs 3명, 각 크루의 mock 근무기록 규모(완전 시드 vs 최소 시드). 김민정 외 크루는 별도 불변식 강제 없이 "0건 이상 + 본인 격리"만 보장하면 충분한지.

---

## 10. Repository Artifacts 갱신 대상

### 10.1 CONTEXT.md (도메인 용어집) — 신규 용어 추가 필요
기존 `CONTEXT.md`에 다음 캐논 정의 1줄씩 추가:
- **마스터(master)**: 매장 점주 역할. 전체 크루의 근무/휴일을 조회하고 수정요청을 수락할 수 있는 유일한 역할. 본인 근무기록은 없을 수 있음.
- **크루(crew)**: 근무자 역할. 본인 crewId 데이터만 조회·생성. 수정요청 생성은 가능하나 수락은 불가. 초대로만 합류.
- **현재 사용자 / 역할 전환(mock)**: 실제 인증 없이 클라이언트가 보유하는 현재 사용자 식별·역할. localStorage 복원. 실보안 아닌 데모 신뢰 모델.
- **crewId 스코프**: store/API가 데이터를 사용자별로 격리하는 키. 미지정 시 기본 `crew-minjung`(김민정)로 fallback(단일사용자 흐름 보존).
- **초대(Invite)**: 마스터가 발급하는 합류 코드(code, status 대기→사용). 크루는 코드로만 active 합류. 만료/회수 미구현(mock).
- **수락 권한(approve gate)**: 수정요청 수락(`approveRequest`)은 role=master만. 크루 시도는 403 + UI 숨김.

### 10.2 docs/adr/ (결정 2개 이상 → ADR 1건 작성)
본 task는 "왜 이걸 골랐는가" 결정이 2개 이상이므로 **ADR 0005** 1건 작성 대상(번호 = 최대 0004 + 1):
- **결정 1**: store crewId 스코프 = 전략 A(인자 append + 기본값 fallback)로 ADR 0004 append-only 선례 계승, 회귀 0 (Q-A 확정 후).
- **결정 2**: 인증 = mock 역할 전환(실 인증·DB 비채택), 권한은 mock 신뢰 모델(헤더/쿼리 신뢰, 위조 미방어) — 이유: 데모 범위·비목표.
- **결정 3**(선택): 현재 사용자 전달 방식(Q-D 결과) 및 권한 경계 처리(Q-C 결과).
> ADR 작성 시점: architect가 phase 2.5에서 Q-A~Q-D 확정값으로 ADR 0005 초안 → reviewer 검증.

### 10.3 운영 메타 (.task-orchestrator.yml)
- 신규 protected_files 후보: 없음(기존 store/seed는 본 task에서 능동 변경 대상이라 보호 부적절).
- 검증 강도 오버라이드 불필요 — 기존 138 테스트 + 신규 AC로 충분.
- 별도 위저드(`task-orchestrator-project-init`) 안내 대상 아님.
