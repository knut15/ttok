# 🛠 구현 노트 (v1) — 마이페이지 + 프로필 수정

- **작성자**: task-developer
- **작성일**: 2026-05-31
- **대상 PRD**: `01-prd.md` (APPROVED) / 승인 `02-approval.md` §0 / 아키텍처 `03-architecture.md`
- **모드**: teammate (로컬 markdown, Notion 미사용)
- **결과**: DoD 4종 전부 GREEN (test 74/74 · tsc 0 · build 0 · lint 0)

---

## ST별 완료

| ST | 내용 | 상태 |
|----|------|------|
| ST-1 | 타입+시드+store 확장 (StoreShape append, getProfile/updateProfile) | ✅ |
| ST-2 | `/api/profile` GET/PATCH + domain 검증 | ✅ |
| ST-3 | `/mypage` 마이페이지 화면 (4섹션) | ✅ |
| ST-4 | `/mypage/profile` 프로필 수정 (인라인 편집) | ✅ |
| ST-5 | BottomNav 활성화 + 통합·DoD | ✅ |

---

## AC 충족 매핑

| AC | 산출물 |
|----|--------|
| AC-1 | `src/lib/store.ts` getProfile + `src/lib/seed.ts` buildSeedProfile/SEED_STORE_INFO — `store.profile.test.ts` |
| AC-2 | `store.ts` updateProfile(화이트리스트 머지) — `store.profile.test.ts` |
| AC-3 | updateProfile 화이트리스트 + `__resetStore`(createStore 경유 자동 리셋) — `store.profile.test.ts` |
| AC-4 | `src/app/api/profile/route.ts` GET — `route.test.ts` |
| AC-5 | route PATCH phone — `route.test.ts` |
| AC-6 | route PATCH email 부분 머지 — `route.test.ts` |
| AC-7 | route 화이트리스트 추출(name/birthDate 무시, 200) — `route.test.ts` |
| AC-8 | `src/features/mypage/domain.ts` isValidEmail/isValidPhone + route 400 — `domain.test.ts`/`route.test.ts` |
| AC-9 | `MyPageView` + ProfileSummary/StoreCard/DocumentBox/ServiceMenu (4섹션 5/5) |
| AC-10 | ProfileSummary `<Link href="/mypage/profile">` |
| AC-11 | placeholder는 `<button type="button">` 무동작(매장등록·문서함·서비스·벨) |
| AC-12 | `app/mypage/profile/page.tsx` + ProfileForm + ProfileFieldRow (5/5) |
| AC-13 | 이름/생년월일 readonly variant, 휴대폰/이메일 인라인 편집 → PATCH 반영 |
| AC-14 | ProfileForm 클라 검증(domain) + useProfile 400 throw → 행 에러 메시지 |
| AC-15 | `BottomNav.tsx` `disabled: true` 1줄 제거 (isActive prefix 매칭 그대로) |
| AC-16 | append-only — 기존 56 테스트 회귀 0, 4탭 라우트 build 정상 |
| AC-17 | 코랄 토큰(bg-coral/text-coral) + Card 재사용 + 모바일 단일 컬럼 + 4섹션/라벨·값 레이아웃 |

---

## 자가 검증 (DoD 실측)

- 빌드: ✅ `pnpm build` exit 0 — 라우트 `/mypage` `/mypage/profile` (static), `/api/profile` (dynamic) 등록 확인
- 타입체크: ✅ `pnpm exec tsc --noEmit` exit 0
- 단위 테스트: ✅ `pnpm test` 74/74 pass (14 파일) — **기존 56 회귀 0 + 신규 18**
- Lint: ✅ `pnpm lint` exit 0

### 신규 테스트 18개 내역
| 파일 | 개수 | 내용 |
|------|------|------|
| `src/lib/store.profile.test.ts` | 5 | getProfile 시드 / updateProfile 머지·부분·화이트리스트·리셋 (AC-1/2/3) |
| `src/features/mypage/domain.test.ts` | 5 | isValidEmail·isValidPhone·EDITABLE_FIELDS (AC-8) |
| `src/app/api/profile/route.test.ts` | 7 | GET·PATCH phone/email/readonly무시/형식400/빈body (AC-4~8, 엣지#6) |
| `src/lib/date.test.ts` (append) | 1 | formatBirthDate (AC-12) |

### TDD 사이클 (vertical slice — horizontal slicing ❌)
| 사이클 | AC | RED → GREEN → REFACTOR |
|--------|----|------------------------|
| 1 | AC-1/2/3 | store.profile.test RED(updateProfile is not a function) → StoreShape append+접근자 GREEN → 리팩토링 불요(deep module) |
| 2 | AC-8 | domain.test RED(no module) → domain.ts GREEN |
| 3 | AC-4~8 | route.test RED(no module) → route.ts GREEN |
| (date) | AC-12 | date.test RED → formatBirthDate GREEN |

UI(ST-3/4)는 결정적 로직이 아니므로 빌드/타입/렌더 깨짐 없음으로 검증(PRD TDD 정책). 검증 로직은 domain.ts에 분리되어 단위테스트로 고정.

---

## 경계면 일치 확인

- **FE ↔ API ↔ store**: `useProfile`/route/`getProfile` 모두 `ProfileResponse`(@/types) 단일 import → 컴파일 강제 일치. PATCH body=`ProfilePatch`(Pick<phone|email>) ⊆ route 화이트리스트 ⊆ updateProfile 인자. name/birthDate 3경계 모두 차단.
- **PRD ↔ store 시드**: 9필드 리터럴(김민정/1986-04-06/010-3126-7299/24joy@naver.com/김/매머드…/2026-04-01/월 ~ 금/08:00~15:00) — `store.profile.test.ts` AC-1로 고정.
- **검증 우선순위**: 형식(400) → 화이트리스트(무시) → 머지(200). AC-8이 AC-7보다 선행 — `route.test.ts`로 고정.

---

## 변경 / 신규 파일

### 신규 (코드)
- `src/features/mypage/domain.ts` + `domain.test.ts`
- `src/features/mypage/hooks/useProfile.ts`
- `src/features/mypage/components/{ProfileSummary,StoreCard,DocumentBox,ServiceMenu,MyPageView,ProfileForm,ProfileFieldRow,BackButton}.tsx`
- `src/app/mypage/page.tsx` · `src/app/mypage/profile/page.tsx`
- `src/app/api/profile/route.ts` + `route.test.ts`
- `src/lib/store.profile.test.ts`

### 수정 (append-only)
- `src/types/index.ts` — UserProfile/StoreInfo/ProfileResponse/ProfilePatch append
- `src/lib/store.ts` — StoreShape에 profile/storeInfo 2필드 + createStore 시드 주입 + getProfile/updateProfile
- `src/lib/seed.ts` — buildSeedProfile/SEED_STORE_INFO append (STORE_NAME 재사용)
- `src/lib/constants.ts` — SEED_JOIN_DATE/SEED_WORK_DAYS/SEED_WORK_TIME append
- `src/lib/date.ts` — formatBirthDate(요일 없음) append
- `src/lib/date.test.ts` — formatBirthDate describe append (기존 assertion 무수정)
- `src/components/BottomNav.tsx` — 마이페이지 `disabled: true` 1줄 제거

### 신규 (문서)
- `CONTEXT.md` — 용어 3개 append(사용자 프로필/매장 정보/읽기전용 필드 정책) + 범위에 마이페이지/프로필 추가
- `docs/adr/0002-readonly-profile-fields.md` — 읽기전용 필드 서버 강제 ADR

---

## architect 설계 준수 / 이탈

- §1~§4 결정 그대로 따름. **설계 이탈 0건.**
- 회귀 방지 5개 인계 포인트 전부 준수: append-only / StoreShape 2필드 append / PATCH 검증 순서 / BottomNav 1줄 / formatBirthDate 신규.
- 기존 `store.test.ts`·`seed.test.ts` 무수정(신규 테스트는 별도 `store.profile.test.ts`).
- 사소한 보강: store readonly-field 런타임 검증 테스트에서 `@ts-expect-error` 2개 → `as Parameters<...>` 캐스트 1개로 변경(2번째 directive가 객체리터럴 excess-property 특성상 unused가 되어 tsc 에러 — 설계 의도(런타임 무시 검증)는 동일 유지).

---

## 미충족 AC

없음 — AC-1~17 전부 충족.
