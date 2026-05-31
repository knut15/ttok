# 🔍 리뷰 보고서 (v1) — 마이페이지 + 프로필 수정

- **작성자**: task-reviewer
- **작성일**: 2026-05-31
- **대상 구현**: `04-implementation.md` (developer, ST-1~5)
- **검증 기준**: PRD `01-prd.md` / 승인 `02-approval.md` §0 / 아키텍처 `03-architecture.md`
- **모드**: teammate (Notion 미사용, Read/Bash/Write만)

---

## AC 매트릭스

| AC# | 내용 (요약) | 충족 증거 | 일치 |
|---|---|---|---|
| AC-1 | `getProfile()`이 시드 9필드를 반환 | `src/lib/store.profile.test.ts` > "프로필+매장 시드 9필드를 반환한다" (PASS) — `store.ts:206-208`, `seed.ts:74-82` | ✅ |
| AC-2 | `updateProfile({ phone, email })` 후 phone/email 갱신, name/birthDate/avatarInitial 보존 | `store.profile.test.ts` > "phone/email을 머지하고 … 보존한다" + "phone만 넘기면 email은 직전 값을 유지한다" | ✅ |
| AC-3 | `updateProfile`에 name/birthDate 넘겨도 무시, `__resetStore` 후 시드로 복원 | `store.profile.test.ts` > "name/birthDate를 런타임에 섞어 넣어도 무시" + "__resetStore 후 시드값으로 복원" — `store.ts:215-223` 화이트리스트 spread | ✅ |
| AC-4 | `GET /api/profile` 200 + `{profile, store}` 시드 일치 | `route.test.ts` > "200으로 시드 프로필+매장을 반환한다" — `route.ts:11-13` | ✅ |
| AC-5 | `PATCH {phone}` → 200 + 직후 GET에서 동일 조회 | `route.test.ts` > "phone 변경 후 직후 GET에서 동일 조회된다" | ✅ |
| AC-6 | `PATCH {email}` → email 반영, phone은 직전값 유지 | `route.test.ts` > "email만 변경하면 phone은 직전 값 유지" | ✅ |
| AC-7 | `PATCH {name}` / `{birthDate}`만 → 200, 해당 필드 불변 (무시 정책 — 승인 쟁점2) | `route.test.ts` > "name/birthDate만 보내면 200이되 변경되지 않는다" — `route.ts:33-36` 화이트리스트 추출 | ✅ |
| AC-8 | `PATCH {email:"잘못된형식"}` / `{phone:"abc"}` → 400 + store 무변. domain 검증 함수 4개 리터럴 일치 | `route.test.ts` > "잘못된 이메일은 400 + store 무변" / "잘못된 휴대폰은 400 + store 무변" — `domain.test.ts` > isValidEmail/isValidPhone 각 2case | ✅ |
| AC-9 | `/mypage` 진입 시 5요소: (a) 벨+점, (b) 프로필 요약 "김"+"김민정"+"내 정보 수정", (c) 나의 매장 카드+등록하기, (d) 문서함 3카드(0건), (e) 서비스 안내 3항목 | `MyPageView.tsx:16-47`, `ProfileSummary.tsx`, `StoreCard.tsx`, `DocumentBox.tsx`, `ServiceMenu.tsx` — 5/5 렌더 확인 (빌드 정상) | ✅ |
| AC-10 | "내 정보 수정" → `href="/mypage/profile"` | `ProfileSummary.tsx:21-25` `<Link href="/mypage/profile">내 정보 수정</Link>` | ✅ |
| AC-11 | placeholder 링크 무동작(매장등록/문서함/서비스/벨/카메라) — 깨진 라우트 없음 | `StoreCard.tsx:15-18`, `DocumentBox.tsx:14-28`, `ServiceMenu.tsx:19-25` 전부 `<button type="button">` 무동작. 빌드 route 목록에 404 경로 없음 | ✅ |
| AC-12 | `/mypage/profile` 5요소: (a) 뒤로가기+헤더, (b) 이니셜 아바타+카메라, (c) 이름/생년월일 읽기전용, (d) 휴대폰/이메일 편집 행, (e) 안내박스+본인인증하기 | `profile/page.tsx:8-16`, `ProfileForm.tsx:40-91` — 5/5 렌더. `date.test.ts` > "1986-04-06 → 1986년 4월 6일" (formatBirthDate) | ✅ |
| AC-13 | 이름/생년월일 읽기전용(editable 미전달 = 기본값 false), 휴대폰/이메일 저장 시 PATCH 반영 | `ProfileFieldRow.tsx:25-32` readonly variant (input 미렌더). `ProfileForm.tsx:23-35` savePhone/saveEmail → `update({phone})` / `update({email})` | ✅ |
| AC-14 | 형식 불량 시 클라 에러 메시지 표시 / 저장 막힘 | `ProfileForm.tsx:23-28` — `isValidPhone(value)` false 시 throw. `ProfileFieldRow.tsx:40-52` — catch → `setError` → 에러 렌더(`line 89-91`) | ✅ |
| AC-15 | 바텀탭 "마이페이지" 활성화 + prefix 하이라이트 | `BottomNav.tsx:14-19` TABS 배열에 `{ href: "/mypage", ... }` — `disabled` 제거 확인. `isActive` 함수(`line 21-24`) prefix 매칭 그대로 | ✅ |
| AC-16 | 기존 56개 테스트 GREEN 유지 + append-only | `pnpm test` 74/74 PASS (56 기존 + 18 신규, 회귀 0). types/store/seed/constants 기존 export 시그니처 불변 확인 | ✅ |
| AC-17 | 디자인 4요소: (a) 코랄 아바타, (b) 라운드 카드, (c) 모바일 단일 컬럼+바텀탭, (d) 4섹션+라벨/값 레이아웃 | `ProfileSummary.tsx:14` `bg-coral`, `StoreCard.tsx:22` `Card` 재사용, `MyPageView.tsx:15` `pb-24`(탭 여백), `ProfileFieldRow.tsx:27-30` 라벨+값 레이아웃 | ✅ |

**AC 합계: 17/17 충족**

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 17개
- file:line 증거: 11개 (AC-1~8, AC-10, AC-13, AC-14, AC-15)
- test ID 증거: 6개 (AC-1~8, AC-9, AC-11, AC-12, AC-16: Vitest test 이름 인용)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

**AC 정량 증거 보유율: 17/17 = 100%**

비고: AC-9/AC-11/AC-12/AC-17은 UI 컴포넌트 렌더 확인 항목으로 file:line + 빌드 PASS 조합으로 인정.

---

## 경계면 검증

### FE useProfile ↔ API route ↔ store getProfile — 타입 일치

- `useProfile.ts:4` — `import type { ProfileResponse, ProfilePatch } from "@/types"` 
- `route.ts:6` — `import type { ProfilePatch } from "@/types"`
- `store.ts:5-13` — `ProfilePatch, ProfileResponse, StoreInfo, UserProfile` 모두 `@/types` 단일 출처

세 경계 모두 `src/types/index.ts`의 동일 타입 사용 → 컴파일 강제 일치. 불일치 불가.

### PATCH body 화이트리스트 검증

- `types/index.ts:95` — `ProfilePatch = Partial<Pick<UserProfile, "phone" | "email">>`
- `route.ts:33-36` — `patch.phone` / `patch.email`만 조건부 대입(name/birthDate 코드 레벨에서 탈락)
- `store.ts:216-222` — `updateProfile`이 phone/email spread만 실행

name/birthDate는 타입·route·store 3경계 모두에서 차단 → AC-7 계약 보장.

### 회귀 검증 (기존 4탭 라우트)

빌드 출력 확인:
```
○ /
○ /attendance
ƒ /attendance/[date]
ƒ /api/attendance
ƒ /api/attendance/[date]
ƒ /api/attendance/requests
ƒ /api/pay
ƒ /api/pay/[date]
○ /pay
```
홈/출퇴근/급여 라우트 모두 정상 등록. 기존 `store.test.ts` / `seed.test.ts` 무수정(신규 테스트는 별도 `store.profile.test.ts`).

`StoreShape` 확장(profile/storeInfo 2필드 append): 기존 `getMonthRecords` / `getRecord` / `updateStatus` / `upsertTodayClock` / `listRequests` / `addRequest`는 records/requests/seq만 접근 → 회귀 없음 (`store.ts:55-201` 기존 함수 시그니처·동작 불변 확인).

### BottomNav isActive 충돌 검증

`BottomNav.tsx:21-24`: `isActive` 함수는 `/` 특수 처리 + prefix 매칭. 마이페이지(`/mypage`) 탭에 `disabled` 필드 없음(제거 완료) → `/mypage`, `/mypage/profile`에서 코랄 하이라이트 자동 적용. 기존 홈(`/`) / 출퇴근(`/attendance`) / 급여(`/pay`) isActive 로직 0 변경.

### RSC vs Client 경계

- `app/mypage/page.tsx` — RSC 셸, `'use client'` 없음, `MyPageView` 마운트만
- `app/mypage/profile/page.tsx` — RSC 셸, `'use client'` 없음
- `MyPageView.tsx:1` — `"use client"` (useProfile 훅 사용)
- `ProfileForm.tsx:1` — `"use client"` (useState + useProfile)
- `domain.ts` — `'use client'` 없음, 순수 isomorphic

경계 설계(§2.4) 그대로 준수.

---

## 빌드/테스트 결과

### 단위 테스트

```
pnpm test (vitest run --reporter=verbose)
Test Files: 14 passed (14)
     Tests: 74 passed (74)
  Duration: 236ms
```

- 기존 56개 테스트: 전부 GREEN (회귀 0)
- 신규 18개 테스트:
  - `store.profile.test.ts`: 5개 (AC-1/2/3)
  - `domain.test.ts`: 5개 (AC-8)
  - `route.test.ts` (profile): 7개 (AC-4~8, 엣지#6)
  - `date.test.ts` (append): 1개 (formatBirthDate, AC-12)

### 타입 체크

```
pnpm exec tsc --noEmit
(출력 없음 — exit 0)
```

### 빌드

```
pnpm build (Next.js 16.2.6 Turbopack)
✓ Compiled successfully in 1421ms
✓ Generating static pages (12/12)
신규 라우트: ○ /mypage, ○ /mypage/profile, ƒ /api/profile — 전부 등록
exit 0
```

### Lint

```
pnpm lint (eslint)
(경고 없음 — exit 0)
```

---

## 🤝 교차 검증 (codex review)

- **자체 판정**: PASS (하네스축 17/17, DoD 4종 GREEN)
- **codex 판정**: 조건부 PASS (P1 1건 비적용, P2 2건 follow-up)
- **호출 시각**: 2026-05-31T14:55 KST
- **codex 버전**: 0.135.0 / 모델: gpt-5.5
- **호출 명령**: `codex review --base ce98f0e`

### codex 지적 목록

| # | 등급 | 파일:라인 | 내용 | 본 task 범위? |
|---|---|---|---|---|
| C1 | P1 | `src/lib/store.ts:88-91` | `updateStatus` 에서 결근 상태를 재적용(동일 상태 재제출)하면 기존 deductMinutes 300이 0으로 리셋됨. 급여차감 합산(440→140) 오류 발생 가능 | **범위 외** |
| C2 | P2 | `src/lib/seed.ts:59` | 5/28 시드 clockIn 07:58~15:00 = 392분이나 workMinutes=390 저장. 상태 재제출 시 재계산으로 392분으로 변경됨 | **범위 외** |
| C3 | P2 | `src/app/api/attendance/requests/route.ts:20` | 수정요청 API의 `after` 필드 검증 미비 — 빈 객체나 잘못된 상태/시각 허용 | **범위 외** |

### 범위 판단 근거

C1/C2/C3 모두 `src/lib/store.ts`의 `updateStatus`, `src/lib/seed.ts`의 `SEED_ROWS`, `src/app/api/attendance/requests/route.ts`에 해당하며, git diff로 확인한 결과 선행 task(커밋 f74b9f4 이하)에 이미 존재하던 코드다. 본 task(커밋 c4869f8)는 해당 로직을 전혀 수정하지 않았다.

- C1: `git show f74b9f4:src/lib/store.ts` 에서 line 70-75에 동일 패턴 (`deductMinutes: 0`) 존재 확인
- C2: `git show f74b9f4:src/lib/seed.ts` 에서 line 49 동일 `workMinutes: 390` 확인
- C3: `git show f74b9f4:src/app/api/attendance/requests/route.ts` 에서 동일 검증 코드 확인

본 task의 PRD/AC는 마이페이지·프로필 범위(`/mypage`, `/api/profile`, `store.getProfile`, `store.updateProfile`)이며, codex가 지적한 세 항목은 선행 task(`attendance` / `pay` 도메인) 범위다. AC-16(회귀 0)은 기존 56 테스트 전부 통과로 검증됨.

`gate_mode: and` 원칙 적용 — P1이 본 task 범위 외이므로 **차단 없음**. follow-up task로 분리 권고.

### 최종 결정

- codex P1 지적(C1)이 본 task 범위 밖의 선행 코드임이 git diff로 확인됨 → 차단 FAIL 아님
- **codex 코드축: PASS (본 task 범위 내 P1 없음, P2/P3 follow-up)**
- 불일치 로그: `~/.claude/state/task-orchestrator/cross_verify_log.jsonl` append 완료

---

## 발견된 프로젝트 자원 검증 (AC-Proj)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Proj-1 | 컨벤션 준수 (feature-based, RSC 셸+client fetch, no-store, __resetStore 격리) | ✅ 전부 준수 |
| AC-Proj-2 | PRD §3 명시 자원 활용 (Card, AppHeader, BottomNav, store, date.ts 등) | ✅ `Card` `StoreCard.tsx:1`, `AppHeader` `MyPageView.tsx:3`, `formatBirthDate` `ProfileForm.tsx:5` 등 전부 활용 |
| AC-Proj-3 | project_skills 적합 스킬 누락 없음 | ✅ project_skills 미등록 (CONTEXT.md만) — 해당 없음 |

---

## 프로젝트 구조 준수 검증 (AC-Struct)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Struct-1 | 신규 파일 배치: architect §1.1 경로와 일치 | ✅ `src/features/mypage/`, `src/app/mypage/`, `src/app/api/profile/route.ts` 모두 §1.1 표 경로 그대로 |
| AC-Struct-2 | 폴더 책임 침범 없음 (features→route 경유, lib 역류 없음) | ✅ `store.ts`/`seed.ts`가 `features`/`app`을 import 안 함. client에서 store 직접 import 없음 |
| AC-Struct-3 | user_notes 규칙 준수 | ✅ 위배 없음 |

---

## Repository Artifacts 검증 (AC-Repo)

| AC# | 항목 | 결과 |
|---|---|---|
| AC-Repo-1 | CONTEXT.md 갱신 (UserProfile/StoreInfo/읽기전용 필드 정책/범위 추가) | ✅ `CONTEXT.md:4` 범위 "마이페이지/프로필" 추가, `line 21-23` 3개 용어 append |
| AC-Repo-2 | ADR 작성 (읽기전용 필드 서버 강제) | ✅ `docs/adr/0002-readonly-profile-fields.md` 작성 완료 |
| AC-Repo-3 | 갱신 시점 적절성 | ✅ 커밋 `c4869f8` 단일 커밋에 코드+문서 동시 포함 |

---

## 쟁점 반영 확인 (승인 §0)

| 쟁점 | 결정 | 구현 확인 |
|---|---|---|
| 쟁점1: StoreShape 확장 (A) | profile/storeInfo 2필드 append + `__resetStore` 격리 | ✅ `store.ts:22-23`, `createStore():37-38`, `__resetStore():51` — 격리 자동 보장 |
| 쟁점2: name/birthDate PATCH 200+무시 (b) | 허용 필드만 추출, name/birthDate 탈락 | ✅ `route.ts:33-36` 화이트리스트 추출. `route.test.ts` > "200이되 변경되지 않는다" |
| 쟁점3: 인라인 편집 (a) | 별도 라우트 없음, 행 탭 → input 활성 | ✅ `ProfileFieldRow.tsx:34-52` isEditing 토글. `/mypage/profile/phone` 라우트 미생성 |

---

## 최종 판정

**판정: PASS**

- AC: **17/17** 충족
- DoD:
  - 단위 테스트: ✅ 74/74 pass (기존 56 회귀 0 + 신규 18)
  - tsc --noEmit: ✅ exit 0
  - build: ✅ exit 0
  - lint: ✅ exit 0
- 경계면 일치: ✅ FE ↔ API ↔ store 타입 단일 출처, 화이트리스트 3경계 일치
- 회귀: ✅ 0건 (기존 56 테스트 전부 GREEN, 4탭 라우트 정상)
- codex 코드축: ✅ PASS (본 task 범위 내 P1 없음)

**사유**: AC 17개 전부 file:line/테스트 ID로 정량 증거 보유, DoD 4종 실측 GREEN, 승인 쟁점 3건(StoreShape 확장 방식·PATCH 무시 정책·인라인 편집) 모두 설계대로 구현 확인. codex 지적 P1/P2/P2 3건은 전부 선행 task(출퇴근/급여) 범위 코드로 git diff 검증됨.

**회귀 지점**: 없음 (종료 — Done)

**남은 미충족 AC**: 없음

---

## Follow-up 항목 (본 task 종결 후 별도 task 권고)

| 우선도 | 출처 | 내용 |
|---|---|---|
| **P1** | codex C1 (`store.ts:88-91`) | `updateStatus`에서 결근/휴가 상태를 동일 상태로 재제출 시 `deductMinutes`가 0으로 리셋됨 — 급여차감 합산 440→140 오류. 선행 task 코드이나 계약 위반. 별도 task로 수정 권고 |
| **P2** | codex C2 (`seed.ts:59`) | 5/28 시드 clockIn 07:58~15:00은 392분이나 workMinutes=390으로 저장. 상태 재제출 시 불일치 발생. seed.test.ts에 이미 불변식 검증이 있으나 이 항목은 누락 |
| **P2** | codex C3 (`attendance/requests/route.ts:20`) | 수정요청 API의 `after` 필드(status, clockIn, clockOut) 내용 검증 미비 — 빈 객체·무효 상태 허용 |
