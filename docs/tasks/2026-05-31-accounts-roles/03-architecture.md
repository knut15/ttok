# 03-architecture — 아키텍처 설계서 (T8: 계정/권한 분리 — 마스터·크루)

> task-architect / 2026-06-01 / mode: teammate
> detected_stack: react-nextjs / pattern: feature-based + nextjs-app-router

## 확정 결정 (승인 + architect 확정)
- **Q-D 전달방식 = 헤더 `x-crew-id` / `x-role`.** 사유: 기존 GET이 쿼리스트링을 쓰므로 헤더 추가는 fetch URL 불변 → 기존 138 테스트 URL 단언 0 영향. Route Handler는 `request.headers.get(...)`로 단일 추출.
- **Q-A = 전략 A** (crewId trailing append + `DEFAULT_CREW_ID="crew-minjung"` fallback). ADR 0004 선례.
- **Q-C = 본인 데이터 강제 스코프** (크루는 타 crewId 무시·본인 강제, 403 아님). 마스터 전용 액션만 크루 차단.
- **Q-E = 마스터 1 + 크루 3** (김민정 포함). **Q-B = 마이페이지 전환 + `/master` 라우트.**

## §1. 변경 범위 & 모듈 경계

### 1.1 배치 원칙
feature-based 준수. 신규 계정/역할/초대/마스터 도메인 = **`src/features/accounts/`** 신설. store/seed/constants/types는 `src/lib/`·`src/types/`에 append-only 확장.

### 1.2 신규/수정 파일 (한 줄 책임)
| 파일 | 신규/수정 | 책임 |
|---|---|---|
| `src/types/index.ts` | 수정(append) | `User`/`Role`/`Crew`/`Invite`/`CrewSummary` 신규 + `AttendanceRecord`·`EditRequest`에 `crewId?` append |
| `src/lib/constants.ts` | 수정(append) | `DEFAULT_CREW_ID="crew-minjung"`, `CREW_IDS`, `MASTER_ID`, 헤더 키 상수(`HEADER_CREW_ID`/`HEADER_ROLE`), 초대코드 알파벳 |
| `src/lib/seed.ts` | 수정(append) | `buildSeedRecordsByCrew`/`buildSeedCrews`/`buildSeedInvites`; **기존 `buildSeedRecords()` 시그니처·반환 불변(김민정)** |
| `src/lib/store.ts` | 수정 | 내부 `recordsByCrew`/`profilesByCrew`/`crews`/`invites`; 9함수 trailing crewId append + fallback; 신규 `listCrews`/`getCrewSummaries`/`createInvite`/`joinByInvite`/`isMaster` |
| `src/lib/scope.ts` | 신규 | 헤더에서 `{crewId, role}` 추출 + 권한 강제(`readScope`/`enforceReadScope`) 순수 헬퍼 |
| `src/features/accounts/context/CurrentUserProvider.tsx` | 신규 | `"use client"` Context — 현재 사용자/역할 + localStorage 복원(mount-gate) |
| `src/features/accounts/hooks/useCurrentUser.ts` | 신규 | Context 소비 훅 + `authHeaders()` export |
| `src/features/accounts/components/RoleSwitcher.tsx` | 신규 | 마이페이지 mock 계정 전환 |
| `src/features/accounts/components/InvitePanel.tsx` | 신규 | 마스터 초대생성 / 크루 코드합류 |
| `src/features/accounts/components/CrewSummaryList.tsx` | 신규 | 마스터 집계 행(presentational) |
| `src/features/accounts/components/MasterView.tsx` | 신규 | `"use client"` 마스터 가드 + 집계뷰 조립 |
| `src/features/accounts/hooks/{useMasterSummary,useInvites}.ts` | 신규 | 집계/초대 fetch |
| `src/features/accounts/domain.ts` | 신규 | 초대코드 생성·검증, 크루 집계 순수함수 |
| `src/app/master/page.tsx` | 신규 | `/master` RSC 셸 |
| `src/app/api/master/crews/route.ts` | 신규 | GET 전체 크루 집계(마스터 게이트, 크루 403) |
| `src/app/api/invites/route.ts` | 신규 | POST 초대생성(마스터만) |
| `src/app/api/invites/join/route.ts` | 신규 | POST 코드합류(400 없는코드/409 사용됨) |
| `src/app/api/crews/route.ts` | 신규 | GET mock 계정 목록 |
| `src/app/api/attendance/route.ts`,`[date]`,`requests`,`pay/*`,`profile` | 수정 | 헤더 scope 추출 → store에 crewId 전달(크루 본인 강제) |
| `src/app/api/attendance/requests/approve/route.ts` | 수정 | **마스터 게이트** role≠master → 403, store 불변 |
| `src/components/BottomNav.tsx` | 수정 | role별 탭(마스터 /master 진입, 크루 기존 4탭) |
| `src/features/attendance/components/{AttendanceDetail,EditRequestList}.tsx` | 수정 | `canApprove=role==='master'` prop 게이트(수락 버튼 숨김) |
| `src/app/layout.tsx` | 수정 | `<CurrentUserProvider>` 래핑 |
| `src/features/{attendance/hooks/useAttendance,pay/hooks/usePay,mypage/hooks/useProfile}.ts` | 수정 | fetch에 `authHeaders()` + crewId effect 의존성(전환 무효화) |
| `src/features/mypage/components/MyPageView.tsx` | 수정 | RoleSwitcher + 마스터 `/master` 진입점 |
| `CONTEXT.md` / `docs/adr/0005-*.md` | 수정/신규 | 용어 + ADR |

### 1.3 의존성 방향 (단방향)
`types ← constants ← seed ← store ← scope ← api routes`; `accounts/domain`·`accounts/hooks → components → app/*`; `accounts/context`(클라). `scope.ts`는 store에만 의존. `accounts/context`는 store 직접 import 금지(route 경유).

## §2. 데이터 흐름 & 계약

### 2.1 신규 타입 (types append — leaf 단일출처)
```typescript
export type Role = "master" | "crew";
export interface Crew { id: string; name: string; role: Role; avatarInitial: string; joinDate: string; active: boolean; }
export interface User { id: string; name: string; role: Role; avatarInitial: string; crewId?: string; }
export type InviteStatus = "대기" | "사용";
export interface Invite { code: string; createdBy: string; targetCrewId?: string; status: InviteStatus; createdAt: string; }
export interface CrewSummary { crewId: string; name: string; avatarInitial: string; workMinutes: number; overtimeMinutes: number; vacationDays: number; }
export interface MasterSummaryResponse { month: string; crews: CrewSummary[]; }
export interface JoinResult { crew: Crew; ok: true; }
```
append(회귀 0): `AttendanceRecord`·`EditRequest`에 `crewId?: string`만 추가.

### 2.2 store 내부 표현
```typescript
interface StoreShape {
  crews: Crew[];
  recordsByCrew: Map<string, Map<string, AttendanceRecord>>; // crewId → date → rec
  requests: EditRequest[];   // crewId 태그(append)
  invites: Invite[];
  profilesByCrew: Map<string, UserProfile>;
  storeInfo: StoreInfo;
  seq: number;
}
```
`createStore()`에서 `recordsByCrew.set("crew-minjung", <기존 buildSeedRecords()로 채운 Map>)` — 김민정 Map 바이트 동일 + crew-2/3 별도 시드.

### 2.3 store 시그니처 변경표 (trailing append + fallback)
| 함수 | After | 내부 |
|---|---|---|
| `getMonthRecords` | `(month, crewId=DEFAULT_CREW_ID)` | 해당 크루 Map filter |
| `getRecord` | `(date, crewId=DEFAULT_CREW_ID)` | 이중 Map 조회 |
| `updateStatus` | `(date,status,crewId=DEFAULT_CREW_ID)` | 로직 불변 |
| `upsertTodayClock` | `(date,field,time,crewId=DEFAULT_CREW_ID)` | 로직 불변 |
| `listRequests` | `(crewId?)` | crewId 있으면 filter, 없으면 전체(마스터/기존테스트) |
| `addRequest` | `(req)` req에 crewId? | 미지정 DEFAULT 태그 |
| `approveRequest` | `(id)` 불변 | `req.crewId ?? DEFAULT`의 Map 반영(게이트는 route) |
| `getProfile` | `(crewId=DEFAULT_CREW_ID)` | profilesByCrew |
| `updateProfile` | `(patch, crewId=DEFAULT_CREW_ID)` | 머지 |
| 신규 | `listCrews()` / `getCrewSummaries(month)` / `createInvite(masterId)` / `joinByInvite(code,crewId)` / `isMaster(id)` | — |
private 헬퍼(`recalcClockFields`/`emptyRecord` 등) 시그니처·로직 불변 → 정책 보존(AC-R4/R5).

### 2.4 현재 사용자 전달 (헤더)
```typescript
// client: authHeaders() → { "x-crew-id": user.crewId ?? user.id, "x-role": user.role }
export function readScope(req: Request): { crewId: string; role: Role } {
  const role = (req.headers.get("x-role") as Role) ?? "crew";
  const crewId = req.headers.get("x-crew-id") ?? DEFAULT_CREW_ID;
  return { role, crewId };
}
export function enforceReadScope(s: {crewId:string; role:Role}, requested?: string): string {
  return s.role === "master" ? (requested ?? s.crewId) : s.crewId; // 크루: requested 무시
}
```
회귀 0: 헤더 부재 → role="crew", crewId=DEFAULT → 김민정 스코프.

### 2.5 API 스코프·권한 규칙
| API | 크루 | 마스터 |
|---|---|---|
| GET attendance/pay/profile | 본인 강제(AC-8) | target 허용 |
| POST requests | 본인 crewId 태그(AC-9) | (미생성) |
| POST requests/approve | **403** + store 불변(AC-18) | 기존 동작(AC-19,R5) |
| GET /api/master/crews | **403**(AC-12) | 전체 집계 |
| POST /api/invites | **403**(AC-15) | 코드 발급(AC-13) |
| POST /api/invites/join | 코드 검증→active(AC-14) | — |

### 2.6 신규 API 계약
```typescript
// GET /api/master/crews?month=YYYY-MM (x-role:master) → 200 MasterSummaryResponse | 403
// POST /api/invites (x-role:master) → 201 Invite | 403
// POST /api/invites/join body{code,crewId} → 200 JoinResult | 400(없는코드) | 409(사용됨)
// GET /api/crews → 200 Crew[] (역할전환 목록)
```

### 2.7 회귀 0 증명
기존 138 테스트 무수정: (1) store/api 테스트 모두 헤더·crewId 인자 생략 → fallback 김민정 (2) `buildSeedRecords()` 불변 → seed.test 9단언 그대로 (3) URL 단언 헤더방식이라 불변. store 내부필드 직접접근 테스트 0건(grep 확인) → store.test 보정 0줄 예상.

## §3. 알고리즘 & 복잡도
| 연산 | 복잡도 |
|---|---|
| getRecord | O(1) |
| getMonthRecords | O(d log d) |
| getCrewSummaries (마스터 집계) | O(C·d), C=3,d≤31 → ≤93 |
| enforceReadScope | O(1) |
| createInvite | O(1) 기대(충돌 재생성 최대 5회 가드) |
| joinByInvite | O(I) find |
| listRequests | O(R) |
O(n²) 없음.

집계 의사코드: crew(role=crew)별 month filter → workMin/otMin reduce, vac=count(휴가). 빈 크루 → 0(NaN 방어, E-5). 크루 본인 강제: `crewId = role=="master" ? (requested ?? self) : self`. 초대 생성 O(1), 검증 find+status전이(멱등 아님, 사용됨 409).

seed 불변식 보존: buildSeedRecords() 무변경 → 차감440/연장6·544/totalPay/5-28(392·67,424) 단언 통과. crew-2/3는 김민정 Map과 물리 분리 → 합산 오염 불가.

## §4. 렌더링 & 권한 경계
- **`/master`**: `app/master/page.tsx` RSC 셸 + `MasterView`('use client') 가드. role은 클라 컨텍스트(localStorage) 진실원이라 SSR 가드 불가 → client 가드. 크루 접근 시 `router.replace("/")`(role 미확정 동안 로딩 가드, 섣부른 리다이렉트 금지). no-store fetch.
- **역할전환 하이드레이션(T6 mount-gate)**: `CurrentUserProvider` 초기 state=김민정(서버 기본 → SSR/CSR 1차 동일, mismatch 0). localStorage는 **mount 후 useEffect에서만** 읽어 복원. 초기 useState에서 읽지 말 것.
- **크루 본인 스코프 fetch(E-3)**: 데이터 훅에 crewId를 effect 의존성 추가 → 전환 시 재실행·무효화. 기존 `active` cleanup으로 stale 차단.
- **EditRequestList 게이트**: `canApprove` prop. 버튼 조건 `status==="대기" && canApprove && onApprove`. AttendanceDetail이 `canApprove={role==="master"}`. UI 숨김 + approve API 403 이중.
- **BottomNav role별**: 크루 기존 4탭. 마스터 /master 진입점(+선택 마스터 탭). 마스터 출퇴근/급여는 본인 기록 없음 → 빈 상태 정상 노출(E-4, crash/NaN 방어 §3). no-store 유지.

## 체크리스트 (자체)
- [x] 회귀 0 증명(헤더 무영향+fallback+buildSeedRecords 불변+내부필드 직접접근 0건)
- [x] store 멀티크루 + 시그니처 append
- [x] 크루 본인 강제 스코프(Q-C)
- [x] 마스터 전용 게이트(수락/집계/초대)
- [x] 초대 흐름(생성/합류/사용됨)
- [x] seed 불변식 보존
- [x] RSC/client·하이드레이션(mount-gate)
- [x] 전달방식 1가지 확정(헤더)

## developer 인계 핵심 4
1. **회귀 0 = 헤더 + trailing fallback.** crewId는 store 함수 맨 뒤 optional(`=DEFAULT_CREW_ID`), 전달은 `x-crew-id`/`x-role` 헤더(URL 불변). 기존 138 테스트 헤더·인자 생략 → 김민정 fallback → 보정 0줄. `buildSeedRecords()` 절대 불변.
2. **스코프(Q-C) = 크루 본인 강제.** `enforceReadScope`에서 크루는 requested 무시·self 강제(403 아님). 타인 노출 0(AC-8).
3. **권한 게이트 3곳(이중).** approve API role≠master→403+store불변; /api/master/crews·/api/invites 마스터 게이트; EditRequestList canApprove prop(UI 숨김).
4. **하이드레이션.** CurrentUserProvider 초기 state=김민정, localStorage는 mount 후 useEffect만. 전환 시 crewId를 fetch 훅 effect 의존성에 추가(E-3, active cleanup 재활용).

## 권장 구현 순서 (각 단계 끝 npm test 게이트)
1. **T8-1** 타입+멀티크루 시드(buildSeedRecords 불변)
2. **T8-2** store recordsByCrew 리팩토링 → **여기서 npm test 138/138 = 회귀 0 증명**
3. **T8-3** CurrentUserProvider+scope.ts+RoleSwitcher(헤더·하이드레이션)
4. **T8-4** 기존 API/hooks 스코프 적용
5. **T8-7** 수락 마스터 게이트(approve 403 + canApprove) — T8-4와 병렬 가능
6. **T8-6** 초대 플로우(api/invites·join + InvitePanel)
7. **T8-5** 마스터 집계뷰(/master + MasterView 가드 + CrewSummaryList + api/master/crews + BottomNav)
8. **T8-8** 통합·회귀 스위프 + CONTEXT.md + ADR 0005 + build

자체 체크리스트 8/8 + 정규식 자가검증 PASS.
