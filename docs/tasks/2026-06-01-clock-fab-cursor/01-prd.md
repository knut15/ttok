# PRD — 출퇴근 등록 FAB + cursor:pointer 전역 (v1)

- Task: `2026-06-01-clock-fab-cursor`
- 작성: task-planner · 2026-06-01
- low_clarity_warning: **false** (사용자 결정 확정 — 가정 섹션 불필요)
- 대상: 기존 Crewmon 앱 UI 확장 2건 (append-only)

---

## 1. 배경 / 문제

현재 `/attendance`(출퇴근 탭)은 월간 캘린더 + 날짜 클릭 상세(보기/수정)만 제공한다. **오늘의 출/퇴근 등록**은 오직 홈(`HomeToday` → `ClockToggle`)에서만 가능하다. 출퇴근 탭에 머무는 사용자가 오늘 출/퇴근을 찍으려면 홈으로 이동해야 하는 동선 단절이 있다.

또한 클릭 가능한 요소(버튼/링크/아이콘) 다수에 `cursor: pointer`가 적용되어 있지 않아(Tailwind v4는 기본 `cursor` 미부여) 데스크톱 hover 시 클릭 가능 여부의 시각 피드백이 일관되지 않다.

### 1.5 Sub-task 분해

| # | Sub-task | 범위 | 사용 가능한 자원 | 적용 phase |
|---|---|---|---|---|
| **ST-1** | 등록 로직 공용 훅 추출 (`useTodayClock`) | `ClockToggle`의 GET 오늘레코드 → phase 인지 → PATCH(authHeaders) 로직을 훅으로 추출. `ClockToggle`은 이 훅을 소비하도록 리팩터(동작 불변). | `useAttendance.ts`(useDayAttendance 패턴), `useCurrentUser.ts`(authHeaders), `date.ts`(nowHHMM) | dev |
| **ST-2** | `ClockFab` 컴포넌트 (client) | 우하단 플로팅 버튼. `useTodayClock` 소비 → phase별 라벨(출근/퇴근/마감-비활성). mount-gate(todayDate client). 등록 후 캘린더 reload 트리거. | `HomeToday`(mount-gate 패턴), `BottomNav`(z-index), `globals.css`(coral) | dev |
| **ST-3** | `/attendance`에 FAB 마운트 + 캘린더 갱신 배선 | `AttendanceCalendarView`에 `ClockFab` 추가. FAB 등록 성공 시 현재 월 캘린더 갱신(`useMonthAttendance.reload` 또는 key 무효화). | `AttendanceCalendarView`, `MonthlyCalendar`, `useMonthAttendance.reload` | dev |
| **ST-4** | cursor:pointer 전역 base 규칙 | `globals.css` `@layer base`에 클릭 요소 cursor 규칙 추가. disabled 제외. | `globals.css` | dev |

> ST-1은 ST-2/ST-3의 선행. ST-4는 독립(병렬 가능).

---

## 2. 목표 / 비목표

### 목표
- `/attendance` 우하단 FAB로 **오늘 출/퇴근을 1탭(또는 1확인) 등록**한다 (홈을 거치지 않는다).
- FAB 등록 로직은 홈 `ClockToggle`과 **단일 진실원(공용 훅)**을 공유한다 — 두 경로 동작 동일.
- 클릭 가능 요소에 `cursor: pointer`를 전역 일관 적용한다.

### 비목표 (Out-of-scope)
- 임의 날짜(오늘 아님) 출/퇴근 등록 — FAB는 **오늘만**. 과거/미래 정정은 기존 날짜 클릭 상세 경로 유지.
- 휴게/연장/상태(지각·결근·휴가) 변경 — FAB는 출근/퇴근 시각 기록만.
- 출퇴근 시각 직접 입력(시:분 선택) — FAB는 현재 시각(`nowHHMM`) 자동.
- 홈 `ClockToggle` UI/위치 변경 — 불변 유지.
- 날짜 클릭 → 상세(보기/수정) 동작 변경 — 불변 유지.
- API/store/도메인 계약 변경 — 기존 `PATCH /api/attendance?date=` 재사용, 신규 엔드포인트 없음.

---

## 3. 솔루션 개요

기존 `ClockToggle` 내부에 인라인된 등록 로직(GET 오늘레코드 → `phase = before/working/done` 인지 → `PATCH {field, time:nowHHMM()}` with `authHeaders(user)`)을 **공용 훅 `useTodayClock(date)`로 추출**한다. `ClockToggle`은 훅 소비로 리팩터하되 렌더 결과·동작은 불변(회귀 0). 신규 `ClockFab`이 같은 훅을 소비해 우하단 플로팅 버튼으로 노출하고, `/attendance`의 `AttendanceCalendarView`에 마운트한다. 등록 성공 시 현재 월 캘린더를 갱신한다.

FAB 탭 시 **즉시 등록**(현재 phase 액션 직행)을 권고한다 — 사유: (1) 등록값이 현재 시각으로 결정적이라 추가 입력이 없고, (2) 홈 `ClockToggle`도 1탭 즉시 등록이라 경로 간 일관성이 유지되며, (3) 가장 단순. (확인 시트 여부는 §Unresolved Q-1로 승인자 위임.)

cursor는 `globals.css` `@layer base` 단일 규칙으로 전역 적용.

### 활용할 프로젝트 자원
- `CONTEXT.md` §"홈 토글 스코프": `ClockToggle`이 `authHeaders(user)` + `crewId`(`user.crewId ?? user.id`) effect 의존성으로 본인 스코프 강제 — FAB도 동일 스코프 계승 (dev)
- `src/features/accounts/hooks/useCurrentUser.ts` `authHeaders(user)`: 크루 스코프 헤더 — 공용 훅에서 호출 (dev)
- `src/lib/date.ts` `nowHHMM()`/`todayDate()`: 등록 시각·오늘 날짜 — client, mount-gate 필요 (dev)
- `src/components/BottomSheet.tsx`: (Q-1이 "확인 시트"로 결정될 경우) 확인 UI 재사용 (dev, 조건부)
- `src/features/attendance/hooks/useAttendance.ts` `useMonthAttendance.reload`: 등록 후 캘린더 갱신 (dev)

### 프로젝트 구조 (feature-based, append-only)
- 패턴: feature-based (`src/features/attendance/{components,hooks,domain}`)
- 신규 산출물 배치:
  - 공용 훅 `useTodayClock` → `src/features/attendance/hooks/useAttendance.ts`에 append (기존 훅 파일과 동거)
  - `ClockFab` 컴포넌트 → `src/features/attendance/components/ClockFab.tsx`
  - cursor 규칙 → `src/app/globals.css` (`@layer base` append)
- z-index 규약(기존): `BottomNav` = `z-30`, `BottomSheet` = `z-50`. **FAB는 `z-40`** (BottomNav 위 + 시트 아래).

---

## 4. 사용자 시나리오

1. (미출근) 크루가 `/attendance` 진입 → 우하단 FAB "출근" 표시 → 탭 → 오늘 출근 시각 기록 → 캘린더 오늘 셀 갱신 → FAB가 "퇴근"으로 전환.
2. (근무중) FAB "퇴근" 탭 → 오늘 퇴근 기록 → FAB가 "마감"(비활성)으로 전환.
3. (마감) FAB는 비활성(클릭 불가) "오늘 근무 마감" 상태.
4. 날짜 셀 탭 → 기존대로 `/attendance/{date}` 상세(보기/수정) — 변화 없음.

---

## 5. 기능 요구사항

### FR-1 출퇴근 등록 FAB
- FR-1.1 `/attendance` 우하단에 FAB 노출. `position: fixed`, `z-40`, BottomNav(높이 ~24, `pb-24` 본문 패딩 존재)와 **겹치지 않게** 충분한 bottom 오프셋(BottomNav 바 위).
- FR-1.2 FAB 라벨/동작은 phase 인지:
  - `before`(미출근, `!clockIn`) → "출근", 탭 시 `PATCH {field:"clockIn", time:nowHHMM()}`.
  - `working`(근무중, `clockIn && !clockOut`) → "퇴근", 탭 시 `PATCH {field:"clockOut", time:nowHHMM()}`.
  - `done`(마감, `clockIn && clockOut`) → "마감", **비활성**(클릭 불가, `cursor` 아님).
- FR-1.3 모든 GET/PATCH는 `authHeaders(user)`로 **현재 크루 스코프** 전송. crewId effect 의존성으로 전환 시 무효화·재fetch(`ClockToggle` 패턴 계승).
- FR-1.4 등록 성공 후 현재 월 캘린더 갱신(오늘 셀 반영).
- FR-1.5 client-only + 오늘 날짜 mount-gate: SSR/첫 CSR에서는 FAB를 렌더하지 않거나 placeholder로 두어 하이드레이션 mismatch 0 (`HomeToday`/`AttendanceCalendarView` `useSyncExternalStore` 패턴).
- FR-1.6 마스터 화면 FAB 노출 정책 → §Unresolved Q-2 (기본 권고: 노출하되 본인 스코프).

### FR-2 cursor:pointer 전역
- FR-2.1 `globals.css` `@layer base`에 규칙 추가:
  ```css
  @layer base {
    button:not(:disabled), a, [role="button"], label, summary { cursor: pointer; }
  }
  ```
- FR-2.2 `disabled` 버튼은 `cursor: pointer` **미적용**(기존 `cursor-not-allowed`/기본값 보존).
- FR-2.3 기존 Tailwind utility로 cursor를 명시한 요소(`cursor-not-allowed` 등)와 충돌하지 않음(utility가 base보다 우선).

---

## 6. Acceptance Criteria

> 형식: Given-When-Then. 객관 검증 가능.

**FAB 노출**
- **AC-1**: Given 크루가 `/attendance` 진입(마운트 후), When 화면 렌더, Then 우하단에 FAB가 1개 노출된다(존재 검증).
- **AC-2**: Given FAB 노출, When DOM 위치 측정, Then FAB는 BottomNav 바와 겹치지 않는다(FAB bottom 오프셋 > BottomNav 높이, `z-40` > BottomNav `z-30`).

**오늘 등록 동작 + 상태 인지**
- **AC-3**: Given 오늘 레코드 미출근(`!clockIn`), When FAB 탭, Then `PATCH /api/attendance?date={오늘} {field:"clockIn", time:nowHHMM()}` 1회 호출되고 FAB 라벨이 "퇴근"으로 전환된다.
- **AC-4**: Given 근무중(`clockIn && !clockOut`), When FAB 탭, Then `PATCH {field:"clockOut", time:nowHHMM()}` 호출되고 FAB가 "마감"(비활성)으로 전환된다.
- **AC-5**: Given 마감(`clockIn && clockOut`), When FAB 렌더, Then FAB는 비활성(클릭해도 PATCH 미호출, `disabled`)이다.
- **AC-6**: Given FAB로 출/퇴근 등록 성공, When 등록 완료, Then 현재 월 캘린더의 오늘 셀이 갱신된 레코드를 반영한다.

**크루 스코프**
- **AC-7**: Given 현재 사용자 crewId=X, When FAB가 GET/PATCH 호출, Then 모든 요청에 `authHeaders` (`x-crew-id: X`)가 포함된다(타 크루 데이터 미접근).
- **AC-8**: Given 역할/계정 전환(crewId 변경), When FAB 재렌더, Then 이전 크루 레코드는 즉시 리셋되고 새 크루 기준으로 phase가 재산정된다.

**cursor:pointer**
- **AC-9**: Given base 규칙 적용, When 활성 `button`/`a`/`[role="button"]`/`label`/`summary`에 hover, Then computed style `cursor: pointer`.
- **AC-10**: Given `disabled` 버튼, When 검사, Then computed style `cursor`가 `pointer`가 **아니다**(규칙에서 제외).

**회귀 방지**
- **AC-R1**: Given 기존 테스트 스위트, When 전체 실행, Then 기존 **191개 테스트 전부 통과**(회귀 0).
- **AC-R2**: Given 홈 `ClockToggle`, When 출근/퇴근/마감 시나리오, Then 추출 전과 **동작 동일**(렌더·PATCH·라벨 불변).
- **AC-R3**: Given 캘린더 날짜 셀, When 탭, Then 기존대로 `/attendance/{date}` 상세로 이동(FAB 추가가 셀 동작에 영향 0).
- **AC-R4**: Given 빌드/타입체크, When 실행, Then 에러 0 + 하이드레이션 경고 0.

---

## 7. 엣지 케이스

| # | 케이스 | 기대 동작 |
|---|---|---|
| E-1 | **마감 상태에서 FAB 탭** | 비활성 — PATCH 미호출, 상태 불변 (AC-5). |
| E-2 | **출근 직후 즉시 퇴근(phase 전환 중)** | 등록 성공 응답으로 record 갱신 → phase 재산정 후에만 다음 액션 활성. busy 가드로 중복 PATCH 방지. |
| E-3 | **마스터 화면에서 FAB** | §Q-2 결정 따름. (기본 권고: 노출 + 본인 스코프, master-1 레코드 없으면 "출근" phase로 시작.) |
| E-4 | **오늘 날짜 미확정(mount 전)** | FAB 미렌더 또는 placeholder — 하이드레이션 안전 (FR-1.5). |
| E-5 | **네트워크 실패(GET/PATCH 4xx/5xx)** | 상태 변경 없음(`res.ok` 가드, `ClockToggle` 동일). busy 해제하여 재시도 가능. |
| E-6 | **0건(오늘 레코드 없음)** | `before`(미출근)으로 인지 → "출근" 노출. |

---

## 8. 메트릭 (성공 판정)

| 지표 | 목표 |
|---|---|
| 기존 테스트 통과율 | 191/191 = 100% (회귀 0) |
| FAB 등록 경로 동작 일치율 | 홈 `ClockToggle`과 동일 PATCH payload/스코프 (공용 훅 단일 진실원 → 100%) |
| 하이드레이션 경고 | 0건 |
| cursor:pointer 적용 | 활성 주요 버튼 hover 시 pointer = 100%, disabled = 0% |

---

## 9. 의존성 / 리스크

- **의존성**: 기존 `PATCH /api/attendance?date=` 엔드포인트(불변 재사용), `authHeaders`, `nowHHMM`/`todayDate`, `useMonthAttendance.reload`. 신규 외부 API·마이그레이션 없음.
- **리스크 R1**: `ClockToggle` 로직 추출 시 동작 변형 → AC-R2(동작 동일)로 가드. 추출 훅은 기존 인라인과 1:1 매핑.
- **리스크 R2**: FAB와 BottomNav z-index/위치 겹침 → `z-40` + bottom 오프셋으로 명시(AC-2).
- **리스크 R3**: cursor base 규칙이 의도치 않은 요소(비클릭 `label` 등)에 pointer 부여 → 영향 경미(label은 클릭 연동이 일반적). 필요 시 utility로 개별 오버라이드.
- **리스크 R4**: FAB의 즉시 등록이 오등록(잘못 탭) 유발 가능 → §Q-1(확인 시트)로 위험 완화 여부 위임.

---

## 10. Repository Artifacts 갱신 대상

- **CONTEXT.md**: 신규 용어 1건 추가 권고 —
  | 용어 | 정의(초안) |
  |---|---|
  | **출퇴근 등록 FAB** (ClockFab) | `/attendance` 우하단 플로팅 버튼. 홈 `ClockToggle`과 공용 훅(`useTodayClock`)으로 등록 로직(오늘 레코드 phase 인지 → `nowHHMM` PATCH, `authHeaders` 크루 스코프) 공유. 출퇴근 입력의 1차 진입점(날짜 클릭은 상세 보기/수정 유지). z-40(BottomNav 위·시트 아래), mount-gate 하이드레이션 안전. |
  - 추가로 §"홈 토글 스코프" 항목에 "FAB도 동일 공용 훅·스코프 공유" 한 줄 보강 권고.
- **docs/adr/**: **신규 ADR 불필요**. 본 task의 결정(즉시 등록 권고, z-40, cursor base 규칙)은 기존 결정(ADR 0001 in-memory, 홈 토글 스코프)의 연장이며 새 아키텍처 선택 2건 미만. (Q-1/Q-2가 비자명하게 결정되면 그때 ADR 검토 — reviewer 판단.)

---

## 📌 Unresolved Questions (승인자 판단 위임)

- **Q-1 (FAB 즉시 등록 vs 확인 시트)**: planner 권고 = **즉시 등록**(현재 시각 결정적 + 홈 토글과 일관 + 최단 동선). 오등록 우려가 크면 `BottomSheet` 확인 1단계 추가 가능(리스크 R4). → 승인자 선택.
- **Q-2 (마스터 화면 FAB 노출 여부)**: 마스터는 본인 출퇴근 기록 의미가 적음(`MASTER_ID="master-1"`, 집계 대상 제외). 또한 마스터 BottomNav는 `/attendance` 탭이 없어(집계+마이페이지 2탭) `/attendance` 직접 진입이 비일반적. planner 권고 = **그대로 노출(본인 스코프)** — 별도 role 분기 없이 단순 유지. 단 "크루만 노출(마스터 숨김)"도 합리적. → 승인자 선택.

---

## Definition of Done

- [ ] ST-1: `useTodayClock` 추출, `ClockToggle` 리팩터 — 동작 불변(AC-R2).
- [ ] ST-2: `ClockFab` 구현 — phase 인지·mount-gate·z-40(AC-1~5).
- [ ] ST-3: `/attendance` FAB 마운트 + 등록 후 캘린더 갱신(AC-6).
- [ ] ST-4: cursor base 규칙 — 활성 pointer·disabled 제외(AC-9, AC-10).
- [ ] 크루 스코프 검증(AC-7, AC-8).
- [ ] 회귀: 기존 191 테스트 통과 + 홈 ClockToggle·날짜클릭 상세 불변(AC-R1~R4).
- [ ] 신규 동작 AC 테스트 추가(FAB 노출·phase 전환·스코프).
- [ ] CONTEXT.md 용어 갱신.
- [ ] Q-1/Q-2 승인자 결정 반영.
