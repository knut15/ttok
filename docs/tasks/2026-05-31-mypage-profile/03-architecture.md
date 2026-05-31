# 🏛️ 아키텍처 설계서 (v1) — 마이페이지 + 프로필 수정

- **작성자**: task-architect
- **작성일**: 2026-05-31
- **대상 PRD**: `01-prd.md` (v1, APPROVED)
- **승인 결정 반영**: `02-approval.md` §0 — 쟁점1(A: StoreShape 확장) / 쟁점2(b: 200+무시) / 쟁점3(a: 인라인 편집)
- **모드**: teammate (Notion 미사용, 로컬 markdown 산출물)
- **detected_stack**: react-nextjs (Next 16 App Router / React 19 / Tailwind v4 / TS5)
- **primary_pattern**: feature-based (+ nextjs-app-router), **append-only 확장**
- **최우선 설계 기준**: 기존 56 테스트 + 4탭 라우트 **회귀 0** (AC-16)

> 본 task는 신규 앱이 아닌 **기존 Crewmon 앱 확장**이다. 모든 §1~§4 결정은 (1) CONTEXT.md 도메인 캐논, (2) 기존 코드 컨벤션(`useMonthAttendance` 훅 / RSC 셸+client fetch / `__resetStore` 격리 / leaf 타입 모듈)을 우선 기준으로 한다.

---

## §1. 변경 범위 & 모듈 경계

### 1.1 신규 파일 (각 파일 단일 책임)

| 경로 | 책임 (한 줄) | 종류 |
|------|-------------|------|
| `src/app/mypage/page.tsx` | `/mypage` RSC 셸 — AppHeader(벨) + 4섹션 컴포넌트 조립만 | RSC |
| `src/app/mypage/profile/page.tsx` | `/mypage/profile` RSC 셸 — 뒤로가기+"프로필 수정" 헤더 + `ProfileForm` 마운트 | RSC |
| `src/app/api/profile/route.ts` | `GET`(프로필+매장 반환) / `PATCH`(휴대폰·이메일만 반영) Route Handler | server |
| `src/features/mypage/components/ProfileSummary.tsx` | 이니셜 아바타 + 이름 + "내 정보 수정" `Link` | client/presentational |
| `src/features/mypage/components/StoreCard.tsx` | "나의 매장" 카드(매장명/입사/근무) + "매장 등록하기 +" placeholder | presentational |
| `src/features/mypage/components/DocumentBox.tsx` | 문서함 카드 3개(급여명세서/근로계약서/기타문서, 카운트 0) placeholder | presentational |
| `src/features/mypage/components/ServiceMenu.tsx` | "서비스 안내·문의" 리스트(공지사항/자주 하는 질문/문의·제안) placeholder | presentational |
| `src/features/mypage/components/ProfileForm.tsx` | 프로필 수정 폼 — 인라인 편집 상태/검증/PATCH 오케스트레이션 | client |
| `src/features/mypage/components/ProfileFieldRow.tsx` | 라벨+값(+편집 input/+`›`) 단일 행 — 재사용 presentational | client |
| `src/features/mypage/hooks/useProfile.ts` | `GET`/`PATCH` client fetch 훅 (`useMonthAttendance` 패턴 답습) | client |
| `src/features/mypage/domain.ts` | `isValidEmail` / `isValidPhone` / `EDITABLE_FIELDS` 순수 함수·상수 | pure (isomorphic) |
| `src/features/mypage/domain.test.ts` | 형식 검증 단위테스트 (신규) | test |
| `src/app/api/profile/route.test.ts` | `GET`/`PATCH` 계약 단위테스트 (신규) | test |

> store profile 갱신 테스트는 기존 `src/lib/store.test.ts`에 **append** (신규 `describe` 블록만 추가, 기존 블록 0 수정).

### 1.2 기존 파일 수정 (최소 / append-only)

| 경로 | 수정 내용 | 회귀 방어 |
|------|----------|----------|
| `src/types/index.ts` | `UserProfile` / `StoreInfo` / `ProfileResponse` interface **append**. 기존 export 시그니처 0 변경 | leaf 모듈, 기존 타입 import처 무영향 |
| `src/lib/store.ts` | `StoreShape`에 `profile: UserProfile; storeInfo: StoreInfo` 2필드 추가, `createStore()`에 시드 주입, `getProfile()`/`updateProfile()` export 추가 | §2.2 격리 설계 참조 — 기존 함수 시그니처·동작 불변 |
| `src/lib/seed.ts` | `buildSeedProfile()` / `SEED_STORE_INFO` **append** | 기존 `buildSeedRecords`/`buildPayItems` 불변 |
| `src/lib/constants.ts` | 매장 부가정보 라벨 상수 append (필요 시). `STORE_NAME` **재사용**(신규 X) | 기존 export 불변 |
| `src/lib/date.ts` | `formatBirthDate()` append (사유 §4.4) | 기존 포맷터 불변 |
| `src/components/BottomNav.tsx` | `TABS` 마이페이지 항목 `disabled: true` **1줄 제거**만 | `isActive` 로직 0 변경 — §4.5 |

### 1.3 모듈 의존성 방향 (단방향 강제)

```
app/mypage/*.tsx (RSC 셸)
        │ 마운트
        ▼
features/mypage/components/* (ProfileForm 등, 'use client')
        │ 호출
        ▼
features/mypage/hooks/useProfile.ts ──fetch──► app/api/profile/route.ts
        │ import (순수)                                  │ import
        ▼                                                ▼
features/mypage/domain.ts                          lib/store.ts (server-only)
                                                         │ import
                                                         ▼
                                                   lib/seed.ts ──► types/index.ts (leaf)
```

- **역류 금지**: `lib/*`·`types`는 `features`/`app`을 import하지 않는다(leaf 유지). `components`는 `domain`(순수)만 의존하고 `store`를 직접 import하지 않는다(반드시 Route Handler 경유 — 기존 규칙).
- `STORE_NAME`은 `constants.ts`에서 단일 출처 재사용(중복 리터럴 금지).

### 1.4 프로젝트 구조 준수

- 신규 feature 코드 → `src/features/mypage/` (기존 `attendance`/`pay` 패턴과 동일 confidence: high 영역).
- 공용 UI(`Card`/`AppHeader`/`BottomNav`)는 `src/components/`에서 **재사용만**(신규 공용 컴포넌트 추가 없음).
- API → `src/app/api/profile/route.ts` (기존 `api/attendance|pay/route.ts` 패턴).
- 패턴 위배 없음. confidence medium 이하 폴더에 신규 파일 배치 없음.

### 1.5 developer 사용 명령 (직접 호출 X, 명시만)

`pnpm test` / `pnpm exec tsc --noEmit` / `pnpm build` / `pnpm lint` (DoD). Vitest 인프라 기설치.

### AC 매핑 (§1)

| AC | 모듈 |
|----|------|
| AC-1~3 | `lib/store.ts`(getProfile/updateProfile) + `lib/seed.ts` |
| AC-4~8 | `app/api/profile/route.ts` + `features/mypage/domain.ts` |
| AC-9~11 | `app/mypage/page.tsx` + `features/mypage/components/{ProfileSummary,StoreCard,DocumentBox,ServiceMenu}` + `hooks/useProfile` |
| AC-12~14 | `app/mypage/profile/page.tsx` + `components/{ProfileForm,ProfileFieldRow}` + `hooks/useProfile` |
| AC-15 | `components/BottomNav.tsx` |
| AC-16 | 전 파일 append-only 강제 (§2.2) |
| AC-17 | components Tailwind 코랄 토큰 재사용 (§4.6) |

---

## §2. 데이터 흐름 & 계약

### 2.1 타입 계약 (`src/types/index.ts`에 append — 기존 export 변경 금지)

```typescript
// === append below existing exports (leaf 모듈, FE↔API↔store 단일 출처) ===
export interface UserProfile {
  name: string;          // "김민정" — 읽기전용
  birthDate: string;     // "1986-04-06" — 읽기전용 (UI "1986년 4월 6일")
  phone: string;         // "010-3126-7299" — 편집 가능
  email: string;         // "24joy@naver.com" — 편집 가능
  avatarInitial: string; // "김"
}

export interface StoreInfo {
  name: string;          // "매머드커피 익스프레스 마석경춘로점" (STORE_NAME 재사용)
  joinDate: string;      // "2026-04-01" (UI "입사 2026.04.01 ~ 재직중")
  employed: boolean;     // true → "재직중"
  workDays: string;      // "월 ~ 금"
  workTime: string;      // "08:00~15:00"
}

export interface ProfileResponse {
  profile: UserProfile;
  store: StoreInfo;
}

// PATCH 허용 필드 — 휴대폰/이메일만. name/birthDate는 타입상 표현 불가(컴파일 방어).
export type ProfilePatch = Partial<Pick<UserProfile, "phone" | "email">>;
```

> `ProfilePatch`를 `Pick<phone|email>`로 좁혀 **타입 레벨에서 name/birthDate 변경 차단**(쟁점2 (b) 무시 정책의 컴파일타임 방어선). 런타임 화이트리스트(§3.1)와 이중 방어.

### 2.2 StoreShape 확장 + `__resetStore` 격리 보장 설계 (쟁점1 (A) — 회귀 핵심)

**확장 방식** (승인 결정 A):

```typescript
// store.ts — StoreShape에 2필드 append
interface StoreShape {
  records: Map<string, AttendanceRecord>; // 기존 — 불변
  requests: EditRequest[];                // 기존 — 불변
  seq: number;                            // 기존 — 불변
  profile: UserProfile;                   // 신규 append
  storeInfo: StoreInfo;                   // 신규 append
}

function createStore(): StoreShape {
  const records = new Map<string, AttendanceRecord>();
  for (const r of buildSeedRecords()) records.set(r.date, r); // 기존 라인 불변
  return {
    records, requests: [], seq: 1,        // 기존 반환 불변
    profile: buildSeedProfile(),          // 신규
    storeInfo: SEED_STORE_INFO,           // 신규
  };
}
```

**회귀 0 보장 논거 (AC-16)**:
1. 기존 store 함수(`getMonthRecords`/`getRecord`/`updateStatus`/`upsertTodayClock`/`listRequests`/`addRequest`)는 `records`/`requests`/`seq`만 읽고 쓴다 → `profile`/`storeInfo` 필드 추가는 이들의 동작·시그니처에 **무영향**.
2. 기존 `store.test.ts`는 `beforeEach(__resetStore)` 후 records/requests만 검증한다 → `createStore()`가 profile을 추가로 시드해도 검증 대상 필드값은 동일.
3. `__resetStore()`는 `createStore()`를 그대로 호출하므로 **profile/storeInfo도 함께 시드 상태로 리셋**됨 → 격리 자동 보장(AC-3). 별도 리셋 로직 불필요(쟁점1 선택지 B가 이 지점에서 실패하는 부분).
4. `globalThis.__crewmonStore` 가드는 그대로 — 단일 싱글톤, 동기화 문제 없음.

**신규 접근자** (append):

```typescript
/** 프로필+매장 조회. O(1). */
export function getProfile(): ProfileResponse {
  const s = getStore();
  return { profile: s.profile, store: s.storeInfo };
}

/** 허용 필드(phone/email)만 머지. 읽기전용 필드는 무시. O(1). 검증은 호출자(route) 책임. */
export function updateProfile(patch: ProfilePatch): UserProfile {
  const s = getStore();
  s.profile = {
    ...s.profile,
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
  };
  return s.profile;
}
```

> `updateProfile`은 `phone`/`email` 외 키를 구조적으로 받지 않음(타입 + 명시적 화이트리스트 spread). `name`/`birthDate`가 런타임에 섞여 들어와도 무시(AC-3).

### 2.3 API 계약 (`GET`/`PATCH /api/profile`) — AC 1:1

기존 `api/attendance/route.ts`의 `NO_STORE` 헤더 + `NextResponse.json` 패턴 답습.

```typescript
const NO_STORE = { "Cache-Control": "no-store" };

// GET /api/profile  → 200 { profile, store }   (AC-4)
export async function GET(): Promise<Response> {
  return NextResponse.json(getProfile(), { headers: NO_STORE });
}

// PATCH /api/profile  body: ProfilePatch
export async function PATCH(request: Request): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;

  // 1) 형식 검증 — 전달된 phone/email만 검사 (AC-8)
  if (typeof body.phone === "string" && !isValidPhone(body.phone))
    return NextResponse.json({ error: "휴대폰 형식 오류" }, { status: 400, headers: NO_STORE });
  if (typeof body.email === "string" && !isValidEmail(body.email))
    return NextResponse.json({ error: "이메일 형식 오류" }, { status: 400, headers: NO_STORE });

  // 2) 허용 필드만 추출 (name/birthDate는 여기서 탈락 — 쟁점2 (b) 200+무시)
  const patch: ProfilePatch = {};
  if (typeof body.phone === "string") patch.phone = body.phone;
  if (typeof body.email === "string") patch.email = body.email;

  // 3) 머지 후 200 + 갱신 profile 반환  (AC-5/6/7)
  const updated = updateProfile(patch);
  return NextResponse.json({ profile: updated, store: getProfile().store }, { headers: NO_STORE });
}
```

| AC | 요청 | 응답 | 계약 |
|----|------|------|------|
| AC-4 | `GET` | 200 `{profile, store}` | 시드 9필드 일치 |
| AC-5 | `PATCH {phone:"010-1234-5678"}` | 200, phone 갱신 | 직후 GET 동일 조회 |
| AC-6 | `PATCH {email:"..."}` | 200, email만 갱신 phone 보존 | 부분 머지 |
| AC-7 | `PATCH {name}` 또는 `{birthDate}`만 | **200**, name/birthDate 불변 | 화이트리스트 탈락(무시) |
| AC-8 | `PATCH {email:"잘못된형식"}` / `{phone:"abc"}` | **400**, store 무변 | 형식 검증이 머지보다 선행 |

> 빈 body `{}` PATCH(엣지#6): 검증 통과 → 빈 patch 머지 → 현재 profile 200 반환(변경 없음). 테스트로 고정.
> 검증 우선순위 = **형식(400) → 화이트리스트(무시) → 머지(200)**. AC-8이 AC-7보다 먼저 평가됨에 유의.

### 2.4 RSC vs Client Component 경계 + 인라인 편집 흐름

- **RSC**: `app/mypage/page.tsx`, `app/mypage/profile/page.tsx` (정적 셸 — 헤더·레이아웃 조립).
- **Client (`'use client'`)**: `ProfileForm`(편집 상태), `useProfile`(fetch), `ProfileSummary`/`ProfileFieldRow`(`Link`/`usePathname` 또는 input 상태). `StoreCard`/`DocumentBox`/`ServiceMenu`는 데이터를 props로 받는 순수 presentational이나, `/mypage` 데이터가 client fetch이므로 부모 client 트리에 포함(기존 `PayList` 패턴과 동일).

**인라인 편집 흐름 (쟁점3 (a))**:
```
ProfileFieldRow(phone) 탭 → isEditing=true → <input> 활성
  → onChange: local state 갱신
  → "저장" 탭 → domain.isValidPhone(value)
       ├ false → 행 하단 에러 메시지 표시, PATCH 미발사 (AC-14)
       └ true  → useProfile.update({phone}) → PATCH → 200 시 setState(응답.profile) + isEditing=false
                  (400 시 에러 메시지, store/UI 불변)
```
- 별도 라우트 없음(`/mypage/profile/phone` 등 미생성) — 인라인.
- name/birthDate 행: `ProfileFieldRow` readonly variant — input 미렌더, 탭 무동작(클라 disabled + 서버 무시 이중 방어).

### 2.5 경계면 일치 검증 (FE ↔ API ↔ store)

- FE `useProfile`이 받는 shape = `ProfileResponse` = `GET` 반환 = `getProfile()` 반환 → **3계층 동일 타입 import**(`@/types`). 불일치 불가(컴파일 강제).
- PATCH body = `ProfilePatch`(phone/email) ⊆ route 화이트리스트 ⊆ `updateProfile` 인자. name/birthDate는 세 경계 모두에서 차단.

### 2.6 append-only 불변 선언

`types/index.ts`·`store.ts`(기존 6함수)·`seed.ts`(기존 3함수)·`constants.ts` 기존 export 시그니처 **0 변경**. `StoreShape`는 인터페이스 필드 추가뿐(기존 필드 불변) → 기존 import처 타입 호환 유지.

---

## §3. 알고리즘 & 클린코드 사전 점검

### 3.1 `updateProfile` 머지 (화이트리스트) — O(1)

- 고정 2키(phone/email)에 대한 조건부 spread → 입력 크기 무관 **O(1)** 시간·공간. 반복문 없음.
- 화이트리스트가 곧 읽기전용 강제: 미허용 키는 대입 자체가 일어나지 않음(중첩 깊이 1).

의사코드:
```
function updateProfile(patch):           # O(1)
    next = {...current}                  # 5필드 고정 복사 O(1)
    if patch.phone defined: next.phone = patch.phone
    if patch.email defined: next.email = patch.email
    current = next
    return next
```

### 3.2 형식 검증 (`domain.ts`) — O(1) 정규식

```
isValidEmail(s):  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)   # 고정 패턴, O(len) ~ 실질 O(1)
isValidPhone(s):  return /^010-\d{3,4}-\d{4}$/.test(s)          # 시드 010-3126-7299 통과
```
- 정규식은 입력 길이 L에 선형(O(L))이나 L이 상수 상한(전화 13자·이메일 합리적 길이)이라 실질 **O(1)**. 백트래킹 폭발 없는 단순 패턴(ReDoS 무관).
- `isValidEmail("ab.com")===false`, `isValidEmail("a@b.com")===true`, `isValidPhone("abc")===false` — AC-8 단위테스트로 고정.
- 빈 문자열 이메일 → false(`@` 부재) → 400 (엣지#1).

### 3.3 profile 조회 / 화면 렌더 복잡도

- `getProfile()`: store 필드 2개 참조 — **O(1)**.
- `/mypage` 4섹션·문서함 3카드·서비스 3항목: 고정 개수 정적 렌더 — **O(1)**(동적 리스트 map 없음; 있더라도 상수 길이).
- O(n²) 이상 발생 지점 없음. 정당화 불요.

### 3.4 클린코드 가이드

- 중첩 깊이 ≤ 3: route PATCH 검증은 early-return(가드절)로 평탄화 — 최대 깊이 2.
- 함수 길이 ≤ 50줄: `updateProfile`·`isValid*`·각 컴포넌트 단일 책임으로 분리.
- 네이밍: CONTEXT.md/기존 코드 컨벤션 우선 — `getProfile`/`updateProfile`(기존 `getRecord`/`updateStatus`와 동형), `buildSeedProfile`(기존 `buildSeedRecords`와 동형).
- `EDITABLE_FIELDS = ["phone","email"] as const` 상수로 매직 리터럴 제거(developer 재량으로 도입 권장).

---

## §4. 렌더링 & 성능 정책 (react-nextjs)

### 4.1 라우트 렌더 전략

- `/mypage`, `/mypage/profile`: **RSC 셸 + client fetch (`cache: 'no-store'`)**. 기존 `usePay`/`useMonthAttendance` 패턴 답습 — 인메모리 store가 진실원이므로 SSG/ISR 부적합(stale 위험), `no-store`로 매 진입 최신 조회. `revalidate` 미사용.
- API Route Handler는 기본 동적(`no-store` 헤더) — 캐시 안 함.

### 4.2 데이터 페칭 / effect 의존성

- `useProfile`: `useEffect`로 마운트 시 1회 `GET`, `useCallback`으로 `update`/`reload` 안정화. effect 의존성은 **`[]`**(profile은 파라미터 없는 단일 리소스 — `useMonthAttendance`의 `[month]`와 달리 의존 인자 없음). cleanup `active` 플래그로 언마운트 후 setState 방지(기존 패턴 답습).
- 재조회 전략: PATCH 200 응답의 `profile`로 직접 setState → 별도 refetch 불필요(왕복 1회). 필요 시 `reload()` 제공.

### 4.3 메모이제이션 / Suspense

- 정적 4섹션·고정 리스트 → 불필요한 리렌더 적음. `React.memo`/`useMemo` 선제 도입 불요(과최적화 금지). 인라인 편집 input은 controlled local state로 폼 단위 격리.
- Suspense 경계 미도입(기존 라우트와 일관 — client fetch + 로딩 가드). 로딩/null 시 스켈레톤·placeholder 렌더로 크래시 방지(엣지#4, 기존 `usePay` null 가드 답습).

### 4.4 날짜 표기 — `formatBirthDate` 신규 (검증된 결정)

- 기존 `formatLongDate("1986-04-06")` → **"1986년 4월 6일 일"**(요일 포함, Bash로 검증). IMG_3618은 **"1986년 4월 6일"**(요일 없음).
- 따라서 `formatLongDate` 재사용 불가 → `lib/date.ts`에 `formatBirthDate(date)` append: `${y}년 ${m}월 ${d}일`(요일 제외). 기존 포맷터 불변.
- 입사일 "2026.04.01"은 기존 `formatDotDate`가 요일 포함("2026.04.01 수")이므로 매장 카드 표기는 `joinDate.replaceAll('-','.')` 단순 변환 또는 전용 헬퍼로 요일 없이 — developer 재량(요일 미표기가 IMG_3616 기준).

### 4.5 BottomNav 활성화 — 기존 `isActive` 충돌 검증

- `isActive(pathname, "/mypage")`: `pathname === "/mypage" || pathname.startsWith("/mypage/")` → `/mypage`·`/mypage/profile` 모두 매칭됨(AC-15 prefix 하이라이트 자동 충족).
- 수정은 `TABS` 배열에서 마이페이지의 `disabled: true` **제거 1줄**뿐. `isActive` 함수·`Icon`·렌더 로직 0 변경 → 기존 3탭(홈/출퇴근/급여) 동작 불변(AC-16). `disabled` 제거 시 해당 항목이 `<button disabled>`에서 `<Link href="/mypage">` 분기로 자동 전환(기존 삼항 분기 재사용).

### 4.6 placeholder 무동작 정책 (AC-11/AC-12)

- 매장 등록하기 `+`, 문서함 3카드, 서비스 안내 3항목, 벨 아이콘, 카메라 아이콘, 본인인증하기: **클릭 무동작**. `<button type="button">`(onClick 없음) 또는 `<span>` — `href="#"`보다 무동작 버튼 선호(스크롤 점프 방지). 404·깨진 라우트 미발생.
- 벨 아이콘: 점(dot) 표시만, 무동작(쟁점3/Q3). 홈 `src/app/page.tsx` 변경 금지(범위 외).

### 4.7 Tailwind 코랄 토큰 재사용 (AC-17)

- 아바타 배경 `bg-coral`, 강조 텍스트 `text-coral`(`globals.css` `--coral` `#F26B4D`). 카드 `Card` 컴포넌트(`rounded-2xl bg-surface`) 재사용. `--muted`/`--surface` 토큰으로 읽기전용 회색 라벨·카드 배경. 신규 색 토큰 추가 없음.

---

## 자체 체크리스트 결과

- [x] §1 모듈 경계 분리됨: ✅ (단방향 의존, features→hooks→route→store→seed→types leaf)
- [x] §2 경계면 타입 일치: ✅ (`ProfileResponse` FE↔API↔store 단일 타입, `ProfilePatch` 화이트리스트)
- [x] §3 시간복잡도 명시: ✅ (updateProfile/검증/조회 전부 O(1))
- [x] §4 렌더링 정책 명시: ✅ (RSC 셸 + client no-store + effect 의존성 + BottomNav 충돌 검증)

### PRD 요구 체크리스트

- [x] 기존 56 테스트·4탭 회귀 없음 보장 설계 — §2.2 논거 1~4, §4.5
- [x] StoreShape 확장 + `__resetStore` 격리 — §2.2 (createStore 경유 자동 리셋)
- [x] append-only (기존 export 불변) — §2.6
- [x] API 계약 AC와 1:1, name/birthDate 무시 — §2.3 (검증 우선순위 형식400→화이트리스트무시→200)
- [x] RSC/client 경계 — §2.4
- [x] 인라인 편집·placeholder 정책 — §2.4, §4.6

---

## 📊 정규식 자가 검증 결과

- §1 파일 경로 패턴(`*.tsx?/ts`): ✅ 다수 매치 (`src/app/mypage/page.tsx`, `src/app/api/profile/route.ts`, `src/features/mypage/domain.ts` 등 13+개)
- §2 타입/계약 코드 블록(```typescript): ✅ 4개 매치 (타입 / StoreShape / 접근자 / route)
- §3 시간복잡도 `O(...)`: ✅ 6+개 매치 (O(1) 다수, 정규식 O(L)~O(1) 분석 포함)
- §4 렌더링 키워드(react-nextjs: RSC/no-store/revalidate/use client/suspense/cache): ✅ 다수 매치
- **자체 PASS** (바이패스 0건, FAIL 0건)

---

## developer 인계 요약 (회귀 방지 최우선)

1. **회귀 0 핵심**: `StoreShape`에 `profile`/`storeInfo` 2필드만 append하고 `createStore()`에 시드 주입. 기존 store 6함수는 records/requests만 다루므로 무영향, `__resetStore()`는 `createStore()` 경유라 profile도 자동 리셋(AC-3 격리 무료). 기존 `store.test.ts`/`seed.test.ts`는 **건드리지 말 것**(신규 테스트는 별도 `describe`/파일로 append).
2. **append-only 절대**: `types/index.ts`·`store.ts`·`seed.ts`·`constants.ts` 기존 export 시그니처 0 변경. `STORE_NAME`은 신규 정의 말고 재사용.
3. **PATCH 검증 순서 고정**: 형식 검증(400) → 허용 필드 화이트리스트 추출(name/birthDate 무시) → 머지(200). 쟁점2 (b) 무시 = 200, 형식 오류 = 400. `ProfilePatch = Pick<phone|email>` 타입으로 컴파일 방어. 신규 테스트 ≥6 (store 갱신·PATCH 부분/거부·형식검증).
4. **BottomNav는 `disabled: true` 1줄 제거만**. `isActive`는 이미 `/mypage` prefix 지원 — 추가 로직 금지.
5. **날짜 주의**: 생년월일은 `formatLongDate`(요일 붙음) 쓰지 말 것 — `formatBirthDate`(요일 없는 "1986년 4월 6일") 신규 append. 인라인 편집은 별도 라우트 없이 행 내 input 토글. placeholder는 무동작 `<button>`(href="#" 지양).
