# 📋 PRD (v1) — Crewmon 마이페이지 + 프로필 수정

- **작성자**: task-planner
- **작성일**: 2026-05-31
- **상태**: 승인 대기
- **운영 모드**: teammate (Notion 미사용, 로컬 markdown 산출물)
- **레포**: `/Users/goyoung/workspace/Study/ttok` (Next.js 16 App Router — **기존 앱 확장**)
- **선행 task**: `docs/tasks/2026-05-31-crewmon-attendance-pay/` (홈/출퇴근/급여 완성, 56 테스트 GREEN)
- **low_clarity_warning**: false (화면 명세·시드·API 계약이 충분히 구체적 — 가정 섹션 불필요)

---

## 0. 목표 / 배경

### 배경
선행 task로 홈 / 출퇴근 / 급여 3개 영역이 완성된 기존 Crewmon 앱에, 바텀탭 4번째 항목인 **마이페이지**(현재 `disabled: true` 플레이스홀더)를 활성화하고 **프로필 수정** 화면을 추가한다. 참조 디자인은 `public/sample/IMG_3616.png`(마이페이지), `public/sample/IMG_3618.png`(프로필 수정). 기존 디자인 시스템(코랄 `#F26B4D`, 모바일 세로, 라운드 카드, 바텀탭)과 패턴(feature-based, Route Handler + 인메모리 store, client fetch + `no-store`)을 그대로 따른다.

### 목표
- `/mypage` 탭을 활성화하고 프로필 요약 / 나의 매장 / 문서함 / 서비스 안내 4개 섹션을 렌더한다.
- `/mypage/profile` 프로필 수정 화면에서 **휴대폰·이메일은 편집 가능**, **이름·생년월일은 본인인증 미구현으로 읽기전용** 동작을 구현한다.
- 인메모리 store에 `UserProfile`·`StoreInfo`를 확장하고 `GET /api/profile` / `PATCH /api/profile` 계약을 추가한다.
- 기존 4개 탭(홈/출퇴근/급여) 라우팅과 56개 테스트가 **회귀 없이** 그대로 통과한다.

### 비목표 (성공의 정의가 아닌 것)
- 픽셀 퍼펙트 일치 (대신 "주요 시각 요소 재현"으로 측정 — AC-13).
- 알림 목록 / 알림 상세 화면 (벨 아이콘은 진입점 placeholder만).
- 문서함 상세(급여명세서·근로계약서·기타문서 본문) / 매장 등록 플로우 / 서비스 안내 각 페이지 / 본인인증 / 사진 업로드 / 휴대폰·이메일 인증 절차.
- 실제 인증·DB·세션. 인메모리 store 유지(서버 재시작 시 시드 리셋 — 명세 동작).

---

## 1. 산출물 종류

| 종류 | 내용 |
|------|------|
| 코드 | `src/app/mypage/` 라우트 2개 + `src/app/api/profile/route.ts` + `src/features/mypage/` UI/훅/도메인 + store/seed/types 확장 + BottomNav 1줄 수정 |
| 테스트 | Vitest 단위 테스트: 프로필 PATCH 검증(휴대폰/이메일 수정 반영, 이름/생년월일 거부), store profile 갱신, 이메일/전화 형식 검증 도메인 함수 |
| 문서 | 본 PRD, CONTEXT.md 갱신(프로필/매장 용어), ADR(읽기전용 필드 결정 — §10 판단) |

### 신규 산출물 배치 위치 (기존 feature-based 구조 인용)

기존 구조(선행 PRD §1 / 실제 코드 확인 결과)를 그대로 따른다:

```
src/app/
  mypage/page.tsx                   # 마이페이지 (/mypage)  ← 신규
  mypage/profile/page.tsx           # 프로필 수정 (/mypage/profile)  ← 신규
  api/profile/route.ts              # GET 프로필+매장 / PATCH 휴대폰·이메일  ← 신규
src/features/mypage/                # ← 신규 feature 디렉터리
  components/
    ProfileSummary.tsx              # 아바타+이름+"내 정보 수정" 링크
    StoreCard.tsx                   # 나의 매장 카드 + "매장 등록하기 +"(placeholder)
    DocumentBox.tsx                 # 문서함 카드 3개(카운트)
    ServiceMenu.tsx                 # 서비스 안내·문의 리스트
    ProfileForm.tsx                 # 프로필 수정 폼(휴대폰/이메일 편집, 이름/생년월일 읽기전용)
    ProfileFieldRow.tsx             # 라벨+값(+ ›) 행 (재사용)
  hooks/useProfile.ts               # GET/PATCH client fetch 훅
  domain.ts                         # isValidEmail / isValidPhone / EDITABLE_FIELDS 등 순수 함수
  domain.test.ts                    # 형식 검증 단위테스트
src/lib/
  store.ts                          # getProfile / updateProfile 추가(확장)
  seed.ts                           # buildSeedProfile() / SEED_STORE_INFO 추가(확장)
  constants.ts                      # 매장 부가정보(입사일·근무요일 라벨) 상수 추가(확장)
src/types/index.ts                  # UserProfile / StoreInfo / ProfileResponse 추가(확장)
src/components/BottomNav.tsx        # 마이페이지 탭 disabled 제거(1줄 수정)
src/app/page.tsx                    # (선택) 홈 헤더 벨을 /mypage 진입점으로 — 범위 외, 변경 금지 권장
```

매칭 근거(실제 코드 확인): 신규 feature 코드 → `src/features/<name>/`, 공용 UI 재사용 → `src/components/`(`Card`/`AppHeader`/`BottomNav`), util/store/seed → `src/lib/`, API route → `src/app/api/<name>/route.ts`, 공용 타입 → `src/types/index.ts`. **기존 타입 파일(leaf 모듈)에 append만 하고 기존 export 변경 금지.**

---

## 1.5 Sub-task 분해 (vertical slice — 5개)

> 각 슬라이스는 "테스트 가능한 가치 단위". ST-1(데이터 계약)이 모든 화면의 토대이므로 선행.

| # | 이름 | 완료 기준 (요약) | 주도 역할 | 의존성 |
|---|------|------------------|-----------|--------|
| **ST-1** | 타입 + 시드 + store 확장 | `UserProfile`/`StoreInfo`/`ProfileResponse` 타입 추가, `seed.ts`에 김민정 프로필+매머드커피 매장 시드, `store.ts`에 `getProfile()`/`updateProfile()` 추가. store 단위테스트(휴대폰/이메일 갱신 반영, 미허용 필드 무변). | developer | — |
| **ST-2** | API route + 도메인 검증 | `GET /api/profile`(프로필+매장 반환), `PATCH /api/profile`(휴대폰/이메일만 수정, 이름/생년월일 PATCH는 400으로 거부 또는 무시). `features/mypage/domain.ts`에 `isValidEmail`/`isValidPhone`. route + domain 단위테스트. | developer | ST-1 |
| **ST-3** | 마이페이지 화면 (`/mypage`) | `useProfile` 훅 + `ProfileSummary`/`StoreCard`/`DocumentBox`/`ServiceMenu`. 4개 섹션 렌더, "내 정보 수정"→`/mypage/profile` 링크, 벨 아이콘(점 표시·placeholder), 문서함 카운트(0/0/0), "매장 등록하기 +"·서비스 항목 placeholder. | developer | ST-2 |
| **ST-4** | 프로필 수정 화면 (`/mypage/profile`) | 뒤로가기+"프로필 수정" 헤더, 아바타(이니셜+카메라 placeholder), 이름/생년월일 읽기전용 행, 휴대폰/이메일 편집 행, 안내박스+"본인인증하기"(placeholder). PATCH 호출로 store 반영 + 형식 검증 에러 표시. | developer | ST-2 |
| **ST-5** | 바텀탭 활성화 + 통합·DoD 마감 | BottomNav 마이페이지 `disabled` 제거, 현재 탭 하이라이트 동작. 기존 4탭 라우팅 회귀 점검. `pnpm test`/`tsc --noEmit`/`build`/`lint` 전부 GREEN. CONTEXT.md 갱신, (필요시) ADR. | developer | ST-3, ST-4 |

권장 진행: ST-1 → ST-2 → ST-3/ST-4 병행 → ST-5.

---

## 2. 사용자 시나리오

1. **마이페이지 진입**: 근무자가 하단 바텀탭 "마이페이지"를 탭하면 `/mypage`로 이동하고, 자신의 프로필 요약(이니셜 아바타 '김', 이름 '김민정')·소속 매장(매머드커피 익스프레스 마석경춘로점, 입사 2026.04.01~재직중, 월~금 08:00~15:00)·문서함 카운트·서비스 안내 메뉴를 한 화면에서 본다.
2. **프로필 확인·진입**: "내 정보 수정"을 탭해 `/mypage/profile`로 이동, 본인의 이름·생년월일·휴대폰·이메일을 확인한다.
3. **연락처 수정**: 휴대폰 또는 이메일 행을 편집해 저장하면 PATCH로 store에 반영되고, 마이페이지/프로필 화면에 갱신된 값이 보인다.
4. **본인인증 필요 인지**: 이름·생년월일은 읽기전용으로 비활성이며, "이름·생년월일을 변경하려면 본인인증을 해주세요" 안내와 "본인인증하기"(placeholder) 버튼을 확인한다.

---

## 3. 솔루션 개요

기존 앱의 4탭 셸·디자인 시스템·데이터 흐름을 그대로 재사용한다. `/mypage`·`/mypage/profile` 두 App Router 라우트를 추가하고, 클라이언트에서 `useProfile` 훅이 `GET /api/profile`(인메모리 store)을 `cache:'no-store'`로 호출한다. 수정은 `PATCH /api/profile`로 store를 갱신한다. **읽기전용 정책(이름·생년월일)은 서버에서 강제** — 클라이언트 disabled에만 의존하지 않고 PATCH가 해당 필드를 거부/무시하여 계약을 단일 출처(store)에서 보장한다. 형식 검증(이메일·전화)은 `features/mypage/domain.ts` 순수 함수로 두어 Vitest로 독립 검증한다.

### 활용할 프로젝트 자원
- `src/components/Card.tsx` (라운드 카드): 매장 카드·문서함 카드·안내박스 — ST-3/ST-4에서 재사용.
- `src/components/AppHeader.tsx` (`brand`/`title`/`right` variant): 프로필 수정 헤더(`title="프로필 수정"`), 마이페이지 우측 벨(`right`) — ST-3/ST-4.
- `src/components/BottomNav.tsx` (4탭, `disabled` 플래그): 마이페이지 활성화 — ST-5. `isActive`가 이미 `/mypage` prefix 매칭을 지원하므로 `disabled` 제거만으로 하이라이트 동작.
- `src/lib/store.ts` (인메모리 싱글톤 + `globalThis` 가드 + `__resetStore`): profile 접근자 추가 — ST-1. 테스트 격리는 `__resetStore` 재사용.
- `src/lib/seed.ts` 패턴 / `src/lib/constants.ts`(`STORE_NAME` 기보유): 시드·상수 확장 — ST-1.
- `src/lib/date.ts`(`formatLongDate` 등 날짜 포맷터): 생년월일 "1986년 4월 6일" 표기 — ST-4에서 활용/확장.
- Tailwind v4 코랄 테마(`globals.css` 토큰: `--coral`, `--coral-soft`, `--surface`, `--muted`): 아바타·강조·카드 — 전 화면.
- (project_skills: 등록된 command/skill/agent 없음. CONTEXT.md만 존재 → 정독 완료. 발견되지 않은 자원 임의 호출 금지.)

### 프로젝트 구조 (기존 구조 인용)
- 패턴: feature-based (+ nextjs-app-router) — 선행 task와 동일.
- 신규 산출물 배치: feature 코드 → `src/features/mypage/`, 공용 UI 재사용 → `src/components/`, util/store/seed/types → `src/lib/`·`src/types/`, API → `src/app/api/profile/route.ts`.
- 데이터 페칭: client fetch + `cache:'no-store'`(인메모리 진실원과 일치) — 기존 `useMonthPay`/`usePay` 패턴 답습.

### 데이터 계약 (신규)

```ts
// src/types/index.ts 에 append (기존 export 변경 금지)
export interface UserProfile {
  name: string;          // "김민정" (읽기전용)
  birthDate: string;     // "1986-04-06" (읽기전용; UI 표기 "1986년 4월 6일")
  phone: string;         // "010-3126-7299" (편집 가능)
  email: string;         // "24joy@naver.com" (편집 가능)
  avatarInitial: string; // "김"
}
export interface StoreInfo {
  name: string;          // "매머드커피 익스프레스 마석경춘로점"
  joinDate: string;      // "2026-04-01" (UI "입사 2026.04.01 ~ 재직중")
  employed: boolean;     // true → "재직중"
  workDays: string;      // "월 ~ 금"
  workTime: string;      // "08:00~15:00"
}
export interface ProfileResponse {
  profile: UserProfile;
  store: StoreInfo;
}
```

- 시드 값: 김민정 / 1986-04-06 / 010-3126-7299 / 24joy@naver.com / 아바타 "김" / 매머드커피 익스프레스 마석경춘로점(`STORE_NAME` 재사용) / 입사 2026-04-01 / 재직중 / 월~금 / 08:00~15:00.
- `PATCH /api/profile` body: `{ phone?, email? }`만 허용. `name`/`birthDate` 포함 시 무시(나머지 허용 필드만 반영) 또는 두 필드만 단독 전송 시 400 — §AC-7/AC-8로 동작 고정.

---

## AC (Acceptance Criteria) — 객관 검증 가능

### 데이터 계약 / store (ST-1)
- **AC-1**: `getProfile()`가 `{ profile, store }`를 반환하고 `profile.name === "김민정"`, `profile.birthDate === "1986-04-06"`, `profile.phone === "010-3126-7299"`, `profile.email === "24joy@naver.com"`, `profile.avatarInitial === "김"`, `store.name === "매머드커피 익스프레스 마석경춘로점"`, `store.joinDate === "2026-04-01"`, `store.workDays === "월 ~ 금"`, `store.workTime === "08:00~15:00"`이다.
- **AC-2**: `updateProfile({ phone: "010-0000-0000", email: "new@x.com" })` 호출 후 `getProfile().profile.phone === "010-0000-0000"` 이고 `email === "new@x.com"`이며, `name`/`birthDate`/`avatarInitial`은 시드값 그대로 유지된다(인메모리 반영).
- **AC-3**: `updateProfile`에 `name`/`birthDate`를 넘겨도 두 필드는 변경되지 않는다(읽기전용 강제). `__resetStore()` 후 다시 시드값으로 복원된다(테스트 격리).

### API (ST-2)
- **AC-4**: `GET /api/profile`가 200으로 `{ profile, store }` JSON을 반환하고, AC-1과 동일한 시드 필드를 포함한다.
- **AC-5**: `PATCH /api/profile`에 `{ phone: "010-1234-5678" }`를 보내면 200과 갱신된 profile을 반환하고, 직후 `GET /api/profile`의 `profile.phone`이 동일하게 조회된다.
- **AC-6**: `PATCH /api/profile`에 `{ email: "24joy@naver.com" }`를 보내면 `email`이 반영되고 `phone`은 직전 값이 유지된다(부분 갱신).
- **AC-7**: `PATCH /api/profile`에 `{ name: "다른이름" }` 또는 `{ birthDate: "2000-01-01" }`만 보내면, 응답상 `name`/`birthDate`가 변경되지 않는다(거부: 400 에러 **또는** 200이되 해당 필드 무시 — 둘 중 하나로 구현하고 테스트로 고정). 어느 쪽이든 이름·생년월일이 바뀌지 않음이 보장된다.
- **AC-8**: `PATCH /api/profile`에 `{ email: "잘못된형식" }`(`@` 없음) 또는 `{ phone: "abc" }`를 보내면 **400**을 반환하고 store가 변경되지 않는다(형식 검증). `domain.isValidEmail("a@b.com") === true`, `isValidEmail("ab.com") === false`, `isValidPhone("010-3126-7299") === true`, `isValidPhone("abc") === false`.

### 마이페이지 화면 (ST-3)
- **AC-9**: `/mypage` 진입 시 (a) 우상단 알림 벨 아이콘(점 표시), (b) 프로필 요약(이니셜 아바타 "김" + 이름 "김민정" + "내 정보 수정" 링크), (c) "나의 매장" 섹션 + 매장 카드("매머드커피 익스프레스 마석경춘로점", "입사 2026.04.01 ~ 재직중", "근무 월 ~ 금 08:00~15:00") + "매장 등록하기 +", (d) "문서함" 카드 3개(급여명세서 확인요청 0 / 근로계약서 서명요청 0 / 기타문서 등록요청 0), (e) "서비스 안내·문의" 리스트(공지사항/자주 하는 질문/문의·제안)가 모두 렌더된다. (5/5 충족 = 통과)
- **AC-10**: "내 정보 수정"을 클릭하면 `/mypage/profile`로 이동한다(`Link href="/mypage/profile"`).
- **AC-11**: "매장 등록하기 +", 문서함 카드, 서비스 안내 항목은 placeholder(클릭해도 깨진 라우트 미발생 — `href="#"` 또는 disabled). 데이터 미로딩/0건 상태에서도 화면이 깨지지 않는다.

### 프로필 수정 화면 (ST-4)
- **AC-12**: `/mypage/profile`에 (a) 뒤로가기 + "프로필 수정" 타이틀 헤더, (b) 아바타(이니셜 "김" + 카메라 아이콘 placeholder), (c) 이름("김민정")·생년월일("1986년 4월 6일") 읽기전용 행, (d) 휴대폰("010-3126-7299")·이메일("24joy@naver.com") 편집 가능 행, (e) 안내박스("이름, 생년월일을 변경하려면 본인인증을 해주세요" + "본인인증하기" placeholder)가 렌더된다. (5/5 충족 = 통과)
- **AC-13**: 이름·생년월일 행은 편집 입력이 비활성(읽기전용)이고, 휴대폰·이메일은 편집 후 저장 시 `PATCH /api/profile`이 호출되어 store에 반영되며, 재진입/재조회 시 갱신값이 표시된다.
- **AC-14**: 휴대폰을 형식에 맞지 않게(예 문자) 입력 후 저장 시도하면 클라이언트가 에러 메시지를 표시하거나 PATCH 400 응답을 받아 저장이 막히고, store 값은 변경되지 않는다.

### 바텀탭 활성화 / 디자인 충실도 / 회귀 (ST-5)
- **AC-15**: 바텀탭 "마이페이지"가 활성화되어(=`disabled` 제거) 탭 시 `/mypage`로 이동하고, `/mypage` 또는 `/mypage/profile`에 있을 때 마이페이지 탭이 코랄로 하이라이트된다(`isActive` prefix 매칭).
- **AC-16 (회귀 방지)**: 기존 4개 탭 중 홈(`/`)·출퇴근(`/attendance`,`/attendance/[date]`)·급여(`/pay`,`/pay/[date]`) 라우트가 종전대로 정상 응답하고, **기존 56개 단위 테스트가 전부 GREEN으로 유지**된다(신규 테스트만 추가, 기존 테스트 수정 0). `src/types/index.ts`·`store.ts`·`seed.ts`·`constants.ts`는 append-only 확장으로 기존 export 시그니처 불변.
- **AC-17 (디자인 충실도)**: 주요 시각 요소 재현 — (a) 코랄/오렌지 아바타 + 1차 강조, (b) 라운드 카드(매장/문서함/안내박스), (c) 모바일 세로 단일 컬럼 + 하단 고정 바텀탭, (d) 마이페이지 4섹션 + 프로필 수정 라벨/값 레이아웃이 IMG_3616/3618과 구조적으로 일치. (4/4 충족 = 통과)

---

## 정량 메트릭

| 지표 | 목표 |
|------|------|
| 단위 테스트 통과율 | `pnpm test` 100% pass (**기존 56 + 신규 ≥ 6**: store 갱신·PATCH 부분/거부·형식검증) |
| 회귀 | 기존 56개 테스트 0개 실패 (수정 없이 유지) |
| 타입 안정성 | `pnpm exec tsc --noEmit` 에러 0 |
| 빌드 | `pnpm build` 성공(exit 0) |
| Lint | `pnpm lint` 에러 0 (warning 허용) |
| 신규 라우트 | `/mypage`, `/mypage/profile`, `GET/PATCH /api/profile` 정상 응답 |
| 디자인 충실도 | AC-17 4요소 4/4, AC-9·AC-12 각 5/5 |

---

## 엣지 케이스 (능동 식별)

1. **이메일 형식 오류**: `@`/도메인 누락 등 잘못된 이메일 PATCH → 400, store 무변(AC-8). 빈 문자열 이메일도 400.
2. **전화 형식 오류**: 숫자/하이픈 외 문자 또는 자릿수 불일치(예 `010-12`) → 400, store 무변(AC-8). 허용 패턴은 `domain.ts`에 명시(예 `^010-\d{3,4}-\d{4}$`).
3. **이름/생년월일 변경 거부**: 읽기전용 필드 PATCH 시 변경 안 됨(AC-3/AC-7) — 클라이언트 disabled + 서버 강제 이중 방어.
4. **profile 미로딩 / fetch 실패**: `useProfile` 로딩 중·null 응답 시 화면이 빈 스켈레톤/플레이스홀더로 표시되고 런타임 크래시 없음(기존 `usePay` null 가드 패턴 답습).
5. **인메모리 휘발성**: 서버 재시작 시 수정한 휴대폰/이메일이 시드값으로 리셋(명세 동작, 버그 아님) — DoD에 명시. 테스트는 `__resetStore`로 격리.
6. **부분 PATCH**: `{ phone }`만 또는 `{ email }`만 전송 시 나머지 필드 보존(AC-5/AC-6). 빈 body `{}` PATCH → 변경 없이 현재 profile 반환(또는 400) — 구현 시 테스트로 고정.
7. **placeholder 링크**: 매장 등록·문서함·서비스 안내·벨·카메라·본인인증 클릭 시 404/깨진 라우트 미발생(AC-11).

---

## 완료 정의 (DoD)

> 테스트 인프라(Vitest)는 선행 task에서 구성 완료. 신규 명령 설치 불필요.

```bash
pnpm test            # 기존 56 + 신규 ≥6, 100% pass
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```

- [ ] AC-1 ~ AC-17 전부 충족
- [ ] `pnpm test` 100% pass — 기존 56 GREEN 유지 + 신규(store 갱신, PATCH 휴대폰/이메일 반영, 이름/생년월일 거부, 이메일/전화 형식검증) 추가
- [ ] `pnpm exec tsc --noEmit` 에러 0
- [ ] `pnpm build` 성공
- [ ] `pnpm lint` 에러 0
- [ ] `/mypage`·`/mypage/profile`·`GET/PATCH /api/profile` 동작, 바텀탭 마이페이지 활성+하이라이트
- [ ] 홈/출퇴근/급여 4탭 라우팅 회귀 없음 (AC-16)
- [ ] 시드 데이터로 두 화면이 빈 화면 없이 채워짐
- [ ] §10 Repository Artifacts 갱신 완료(CONTEXT.md; ADR은 §10 판단)

---

## 8. 의존성 / 선행 조건

- **선행 task 산출물 의존**: BottomNav(`disabled` 플래그·`isActive` prefix), `Card`/`AppHeader`, `store.ts`(`globalThis` 가드·`__resetStore`), `seed.ts`/`constants.ts`(`STORE_NAME`), `lib/date.ts` 포맷터, Vitest 인프라 — 모두 존재 확인됨.
- **버전**: Next 16.2.6 / React 19.2.4 / Tailwind v4 / TS5 (기설치).
- **외부 API/DB/인증**: 없음(인메모리). 네트워크 실패는 로컬 fetch 한정.
- **데이터**: 시드 정확도가 화면 검산 기준. 시드 값은 IMG_3616/3618 텍스트로 검산됨(김민정/1986.4.6/010-3126-7299/24joy@naver.com/입사 2026.04.01/월~금 08:00~15:00).

---

## 9. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| `src/types/index.ts`·`store.ts` 확장 시 기존 export 변경으로 회귀 | 56 테스트 깨짐 | **append-only** 확장 강제(AC-16). 기존 함수 시그니처 불변. |
| BottomNav `disabled` 제거가 기존 탭 동작에 영향 | 라우팅 회귀 | 1줄 수정(`disabled: true` 제거)만. `isActive`는 이미 `/mypage` prefix 지원 — 추가 로직 불필요. |
| 이름/생년월일 거부 방식(400 vs 무시) 모호 | 테스트 불안정 | §AC-7에서 "둘 중 하나로 구현 후 테스트 고정"으로 명시 — §Unresolved Q1 확인. |
| 전화 허용 패턴 과/소엄격 | 정상 번호 거부 | `domain.ts`에 패턴 단일 정의 + 단위테스트. 시드값 `010-3126-7299` 반드시 통과. |
| 프로필 수정 행 편집 UX(인라인 vs 바텀시트) 미명세 | 디자인 해석 차 | IMG_3618은 행 끝 `›`(상세 진입 암시) — §Unresolved Q2. 잠정: 인라인 편집(가장 단순) 또는 행 탭→입력. AC는 "PATCH 반영"으로 측정(UX 형태 무관). |

---

## 📌 Unresolved Questions (승인자 판단 위임)

1. **이름/생년월일 PATCH 거부 방식**: (a) 해당 필드 포함 시 400 에러 vs (b) 200이되 무시(허용 필드만 반영). 잠정: **(b) 무시** — 부분 PATCH 자연스러움 + 클라이언트는 애초에 전송 안 함. 형식 오류(이메일/전화)는 별개로 400(AC-8).
2. **휴대폰/이메일 편집 UX**: IMG_3618은 행 끝에 `›`가 있어 별도 입력 화면 진입처럼 보임. 본 범위에선 별도 라우트 없이 **인라인 편집(또는 행 탭 시 입력 활성)** 으로 단순화 제안. 별도 입력 화면이 필요하면 교정 요청.
3. **벨 아이콘 진입점**: 알림 목록은 범위 밖이므로 점 표시만 있는 placeholder로 둔다(클릭 무동작 또는 `#`). 홈 화면 벨(`src/app/page.tsx`)도 현재 placeholder이며 본 task에서 변경하지 않음 권장.

(※ `low_clarity_warning`은 false — 위 항목은 설계 선택지 확인용이며, 미응답 시 잠정안으로 진행. 화면/시드/계약은 충분히 명확하여 가정 섹션 불필요.)

---

## 10. Repository Artifacts 갱신 대상

1. **CONTEXT.md (도메인 용어집)** — 존재함(`/Users/goyoung/workspace/Study/ttok/CONTEXT.md`). **갱신 필요**. 추가 캐논 정의:
   - **사용자 프로필(UserProfile)**: 근무자 개인정보 `{ name, birthDate, phone, email, avatarInitial }`. 이름·생년월일은 본인인증 전 **읽기전용**, 휴대폰·이메일은 편집 가능.
   - **매장 정보(StoreInfo)**: 소속 매장 `{ name, joinDate, employed, workDays, workTime }`. UI 표기 "입사 YYYY.MM.DD ~ 재직중 / 근무 월~금 HH:MM~HH:MM".
   - **읽기전용 필드 정책**: 이름·생년월일 변경은 본인인증(미구현)을 전제로 하며, 서버 PATCH가 해당 필드를 거부/무시하여 계약 단일 출처(store)에서 강제한다.
   - 범위 표기 갱신: CONTEXT.md 상단 "범위: 홈 / 출퇴근 / 급여"에 "/ 마이페이지 / 프로필" 추가.
2. **docs/adr/** — 기존 `0001-in-memory-route-handler.md` 존재. 본 task의 결정은 **읽기전용 필드 서버 강제 정책 1건**이 핵심. 결정이 2건 미만이므로 **신규 ADR 작성은 선택**(developer/architect 판단). 작성 시 `0002-readonly-profile-fields.md`(이름·생년월일 서버 거부 이유: 본인인증 미구현, 클라이언트 disabled 단독 신뢰 불가).
3. **운영 메타(.task-orchestrator.yml)**: 변경 불필요. 별도 위저드 안내 없음.
