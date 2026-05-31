# 02-approval — 승인 결정 (v1)

- **작성자**: task-approver
- **작성일**: 2026-05-31
- **대상 PRD**: `01-prd.md` (v1, task-planner 작성)
- **모드**: teammate (Notion 미사용)
- **현재 단계**: ✅ APPROVED (사용자 최종 컨펌 2026-05-31)

## 0. 최종 사용자 결정 (오케스트레이터 기록)
**판정: APPROVE** — 아래 3개 결정 반영(FAIL #7 해소).

| 쟁점 | 결정 | architect/developer 지침 |
|---|---|---|
| 1 StoreShape 확장 | **StoreShape 필드 추가** | 기존 `StoreShape`에 `profile`(+매장 storeInfo) 필드 추가. `createStore()`가 profile 시드 포함, `__resetStore()`가 profile도 함께 리셋(테스트 격리 보장). 기존 records/requests 검증 테스트 회귀 없음 확인 필수. |
| 2 이름/생년월일 PATCH | **200 + 무시** | name/birthDate 포함 PATCH는 200 반환하되 해당 필드 변경 무시. 휴대폰/이메일만 반영. 클라이언트는 name/birthDate 입력을 disabled 처리. |
| 3 편집 UX | **인라인 편집** | 휴대폰/이메일은 `/mypage/profile` 화면 내 인라인 편집(별도 라우트 없음). AC 체계 변경 없음. |

---

## 1차 자동 검증 결과

### 검증 근거 파일

| 파일 | 확인 목적 |
|------|-----------|
| `docs/tasks/2026-05-31-mypage-profile/01-prd.md` | 검증 대상 |
| `src/types/index.ts` | append-only 확장 기반선, 기존 export 목록 |
| `src/lib/store.ts` | StoreShape, globalThis 가드, __resetStore 패턴 |
| `src/lib/seed.ts` | STORE_NAME 활용, buildSeedRecords 패턴 |
| `src/lib/constants.ts` | STORE_NAME = "매머드커피 익스프레스 마석경춘로점" 확인 |
| `src/components/BottomNav.tsx` | disabled:true 플래그 위치, isActive prefix 로직 |
| `CONTEXT.md` | 범위 정의, 도메인 캐논 |
| `public/sample/IMG_3616.png` | 마이페이지 참조 디자인 |
| `public/sample/IMG_3618.png` | 프로필 수정 참조 디자인 |
| `pnpm test` 실행 결과 | 56 테스트 GREEN 기준선 확인 |

---

### 체크리스트 결과표 (PASS 7/8)

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| 1 | AC 검증가능성 | PASS | AC-1~17 전부 구체적 리터럴 값·HTTP 상태코드·개수 기준으로 측정 가능. 예: AC-1은 9개 필드 리터럴 비교, AC-8은 400 응답 + store 무변, AC-16은 "56개 테스트 0개 실패"로 정량화. AC-17은 "4/4 충족"이라는 수치 기준 존재. 주관 판단 여지 있는 항목 없음. |
| 2 | 범위 명확성 | PASS | 비목표(§0)에 알림 목록·문서함 상세·매장 등록·본인인증·사진 업로드가 명시. AC에 해당 항목이 기능 요건으로 혼입되지 않음(AC-11이 명시적으로 placeholder 처리). 벨 아이콘·카메라·본인인증하기도 "placeholder" 로 경계 표시. |
| 3 | DoD 실행가능성 | PASS | `pnpm test / tsc --noEmit / build / lint` 4개 명령 모두 실행 가능한 형태로 명시. 기존 56 테스트 GREEN은 실행 결과로 확인됨(현재 56 pass). 신규 최소 6개 테스트 항목(store 갱신·PATCH 반영·이름/생년월일 거부·형식검증)이 구체적으로 열거됨. Vitest 인프라 기존 설치 확인. |
| 4 | 구조 일관성 | PASS | 신규 파일 배치가 기존 feature-based 패턴과 정합: `src/features/mypage/`(기존 attendance/pay 패턴), `src/app/api/profile/route.ts`(기존 attendance/pay route 패턴), `src/types/index.ts` append-only, `store.ts`·`seed.ts`·`constants.ts` 확장. BottomNav 수정은 1줄(disabled 제거)만으로 한정. |
| 5 | 회귀 안전성 | PASS | AC-16에서 "기존 56개 단위 테스트 전부 GREEN, 신규 테스트만 추가·기존 테스트 수정 0"을 명시. `src/types/index.ts`·`store.ts`·`seed.ts`·`constants.ts` append-only 강제 선언. BottomNav는 기존 탭의 `isActive` 로직을 건드리지 않음(코드 확인: isActive는 이미 prefix 매칭, disabled 제거만 필요). StoreShape에 profile 필드를 어떻게 추가할지(기존 shape 확장 방식) 명시는 없으나 "append-only" 원칙으로 커버됨. |
| 6 | sub-task 분해 적정성 | PASS | 5개 vertical slice(ST-1~5). ST-1(타입/시드/store) → ST-2(API/도메인) → ST-3/4 병행 → ST-5(통합/DoD)로 의존성 방향이 논리적. 각 슬라이스마다 "완료 기준"이 서술됨. 4~6개 권장 범위 내. ST-3/4 병행 가능성은 "ST-2 의존"이라고 명시되어 있어 순서가 보장됨. |
| 7 | 시드/계약 정합성 | FAIL | **부분 불일치 발견.** 아래 세부 사항 참조. |
| 8 | Unresolved Questions | PASS | Q1(이름/생년월일 거부 방식)·Q2(편집 UX)·Q3(벨 진입점) 3건 표면화, 각각 잠정안(b무시/인라인/placeholder)을 제시. Q1 잠정안(무시)이 AC-7 서술("둘 중 하나로 구현 후 테스트 고정")과 연결됨. 미응답 시 잠정안으로 진행한다는 방침 명시. 적절한 리스크 표면화. |

---

### FAIL 항목 세부 — #7 시드/계약 정합성

#### 발견 사항 A: `StoreInfo.workDays` 값 불일치

PRD AC-1에서 `store.workDays === "월 ~ 금"` (공백 포함)을 시드 기준으로 고정한다.

그런데 IMG_3616의 실제 화면 표기는 `근무 월 ~ 금 08:00~15:00` 이며,
IMG_3618에는 근무요일이 별도로 표시되지 않는다.

AC-1의 `"월 ~ 금"` 값은 화면 표기문자열과 일치하므로 이 자체는 문제없다.
그러나 `StoreInfo.workDays` 필드 설계에서 **workDays와 workTime을 합쳐 UI 문자열을 조립하는 방식**인지, 아니면 `workDays`가 이미 합산 문자열(`"월 ~ 금 08:00~15:00"`)인지가 타입 정의(`workDays: string` vs `workTime: string` 분리)와 AC-1(`workDays === "월 ~ 금"`, `workTime === "08:00~15:00"` 별도)로 명확히 분리되어 있어 **이 부분은 실제로 일관됨**.

재검토 결과 A는 PASS로 번복.

#### 발견 사항 B: `StoreInfo`에 `STORE_NAME` 재사용 명시 — 실제 constants.ts 값과 일치 여부

`constants.ts`에서 `STORE_NAME = "매머드커피 익스프레스 마석경춘로점"` 확인.
PRD AC-1의 `store.name === "매머드커피 익스프레스 마석경춘로점"` 과 일치. PASS.

#### 발견 사항 C (실제 FAIL): `StoreShape` 확장 방식 미명세로 인한 잠재적 회귀

`src/lib/store.ts`의 `StoreShape` 인터페이스는 현재 `records`, `requests`, `seq` 3개 필드만 보유한다. PRD는 "store.ts에 `getProfile()` / `updateProfile()` 추가"라고 명시하지만, **`StoreShape`에 profile 필드를 추가하는 구체적 방법이 두 가지** 중 어느 것인지 미확정이다:

- 방법 1: `StoreShape`에 `profile: UserProfile; store: StoreInfo` 필드를 추가(shape 확장)
- 방법 2: 별도 `globalThis.__crewmonProfile` 싱글톤 분리

방법 1은 `createStore()` 함수와 `__resetStore()` 함수도 수정해야 하므로, 이 수정이 기존 store 함수(`getMonthRecords`, `getRecord`, `updateStatus`, `upsertTodayClock` 등)의 동작에 영향을 줄 수 있다. PRD는 "append-only"를 선언했지만 `StoreShape` 인터페이스 자체에 필드 추가가 필요한 경우 기존 `createStore()`도 수정이 불가피하다.

**이는 AC-16(기존 56개 테스트 GREEN 유지)의 위협 요인**이며, 아키텍처 단계에서 명확히 결정해야 할 사항이 PRD에서 정의되지 않은 채 "확장"으로 뭉뚱그려져 있다.

#### 발견 사항 D (추가 관찰): `AC-7` 동작 미확정이 테스트 계약에 영향

AC-7이 "400 에러 OR 200이되 무시 — 둘 중 하나로 구현 후 테스트 고정"이라고 명시하지만, 이는 **테스트 코드가 작성 전까지 계약이 확정되지 않음**을 의미한다. Q1 잠정안(무시/200)이 있으나 승인자 확정 없이 구현자가 결정하게 된다. 이는 엄밀히 "AC가 객관 검증 가능한가" 관점에서는 두 경로 모두 인정하므로 AC-1 검증 항목과는 별개로, **PRD 계약의 이중성**이 남아 있다.

---

**FAIL 요약**: 항목 7은 발견 사항 C(StoreShape 확장 방식 미명세)로 FAIL. D는 WARNING 수준(사용자 컨펌으로 해소 가능).

---

## 2차 사용자 컨펌 요청

> 1차 AI 검증에서 7/8 PASS, 1개 항목(#7 시드/계약 정합성)이 FAIL입니다.
> FAIL 사유가 구현 방식 선택의 문제이므로, 자동 REWORK 반환 대신 사용자 컨펌을 통해 방향을 결정하고 아키텍처 단계로 넘길 수 있습니다.
> 아래 3개 쟁점에 대해 답변해 주시면 승인 여부를 확정합니다.

---

### 쟁점 1 (FAIL 원인) — StoreShape 확장 방식

**배경**: 현재 `store.ts`의 `StoreShape`는 `{ records, requests, seq }` 3필드. profile 데이터를 추가하면 `StoreShape` 인터페이스 자체가 수정되고 `createStore()` / `__resetStore()`도 변경됩니다. 이는 기존 56개 테스트에 영향을 줄 수 있는 유일한 진입점입니다.

**선택지**:

- **(A) StoreShape에 profile/store 필드 추가**: `StoreShape`에 `profile: UserProfile; storeInfo: StoreInfo`를 추가하고 `createStore()`, `__resetStore()`를 함께 수정. 기존 테스트가 `__resetStore()`를 직접 호출하므로, `createStore()`에 profile 시드를 추가해도 기존 테스트 로직에는 영향 없음. 단일 싱글톤 관리로 일관성 높음. **권장.**

- **(B) 별도 globalThis 싱글톤 분리**: `globalThis.__crewmonProfile`을 별도로 관리. 기존 `store.ts` 터치 최소화. 단, 두 싱글톤의 동기화 문제와 `__resetStore()`가 profile을 리셋하지 않는 문제가 발생.

**권고**: (A) 선택. `createStore()` 수정이 불가피하지만 기존 테스트는 profile 필드에 무관하게 records/requests만 검증하므로 회귀 위험 낮음. 아키텍처 단계에서 "StoreShape 확장 방식 (A) 채택"을 명시 후 진행 요청.

**사용자 결정 필요**: (A)로 진행해도 됩니까, 아니면 (B)가 필요합니까?

---

### 쟁점 2 (Unresolved Q1 확정) — 이름/생년월일 PATCH 거부 방식

**배경**: AC-7이 "400 반환 OR 200이되 무시 — 둘 중 하나로 구현 후 테스트 고정"으로 이중 허용 상태입니다. PRD 잠정안은 **(b) 200 + 무시**입니다.

**선택지**:

- **(a) 400 반환**: `name`/`birthDate` 포함 body → 에러 반환. 클라이언트가 에러 처리 필요. 서버 명시적 거부.
- **(b) 200 + 무시**: 허용 필드(`phone`/`email`)만 반영, 나머지 조용히 무시. 클라이언트는 에러 처리 불필요. 부분 PATCH 표준에 가까움. **PRD 잠정안.**

**권고**: (b) 무시. 클라이언트는 이름/생년월일을 disabled로 처리하므로 애초에 전송하지 않음. 구현 단순성 우위.

**사용자 결정 필요**: PRD 잠정안 (b) 무시로 확정해도 됩니까?

---

### 쟁점 3 (Unresolved Q2 확정) — 휴대폰/이메일 편집 UX 방식

**배경**: IMG_3618 화면에서 휴대폰·이메일 행 끝에 `>` 화살표가 있습니다. 이는 별도 화면 진입을 암시하지만, PRD 잠정안은 별도 라우트 없이 **인라인 편집**으로 단순화를 제안합니다.

**선택지**:

- **(a) 인라인 편집**: 행 탭 시 해당 행이 input으로 활성화. 별도 라우트 불필요. AC-13의 "PATCH 반영"을 충족하는 가장 단순한 구현.
- **(b) 별도 입력 화면**: `/mypage/profile/phone`, `/mypage/profile/email` 등 추가 라우트. 디자인 충실도 높으나 sub-task 추가 필요.

**권고**: (a) 인라인 편집. AC-17 디자인 충실도는 "구조적 일치"를 기준으로 하며, `>` 아이콘은 편집 가능함을 시사하는 것으로 인라인 편집으로도 재현 가능. 범위 확장 없이 현재 AC 체계 내에서 해결.

**사용자 결정 필요**: (a) 인라인 편집으로 진행해도 됩니까, 아니면 (b) 별도 화면이 필요합니까?

---

## 현재 상태 요약

| 구분 | 내용 |
|------|------|
| 1차 AI 검증 | 7/8 PASS |
| FAIL 항목 | #7 시드/계약 정합성 (StoreShape 확장 방식 미명세) |
| WARNING | AC-7 이중 계약(Q1 확정으로 해소 가능) |
| 결정 | 사용자 컨펌 대기 — 3개 쟁점 답변 필요 |
| 다음 단계 | 사용자 답변 후 APPROVE / REWORK 확정 → 아키텍처 단계 |

> **자동 승인 금지 원칙에 따라, 사용자 컨펌 전까지 APPROVE 확정하지 않습니다.**

---

## 2차 사람 결정 (작성 대기)

- 결정: _미확정 — 사용자 답변 대기_
- 코멘트: _쟁점 1~3 답변 수신 후 기재_
