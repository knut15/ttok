# 04-implementation — 구현 노트 (T11: 출퇴근 등록 FAB + cursor pointer)

- task-developer / TDD(vertical slice) / append-only / 회귀 0
- 입력: 01-prd / 02-approval(Q1 즉시등록·Q2 마스터 노출) / 03-architecture(§1~§4 + 인계 5개)

## AC 충족 매핑

| AC | 충족 위치 | 요약 |
|---|---|---|
| AC-1 FAB 노출 | `ClockFab.tsx` | mount 후 fixed 우하단 버튼 1개 |
| AC-2 비겹침 | `ClockFab.tsx` `bottom-28 z-40` | BottomNav `pb-24`/`z-30` 위 |
| AC-3 미출근→출근 | `useAttendance.ts useTodayClock.clock("clockIn")` + `ClockFab` | PATCH `{field:"clockIn",time:nowHHMM()}` → phase working |
| AC-4 근무중→퇴근 | 동 `clock("clockOut")` | PATCH `{field:"clockOut"}` → phase done(비활성) |
| AC-5 마감 비활성 | `ClockFab` `disabled = phase==="done"` | 클릭 불가, PATCH 미호출 |
| AC-6 캘린더 갱신 | `AttendanceCalendarView` reloadKey → `MonthlyCalendar` effect reload | onRegistered → setReloadKey → reload() |
| AC-7 크루 스코프 | `useTodayClock` `authHeaders(user)` | GET/PATCH 모두 x-crew-id |
| AC-8 전환 무효화 | `useTodayClock` effect deps `[date, crewId]` + setRecord(null) | crewId 변경 시 리셋·재산정 |
| AC-9 cursor pointer | `globals.css @layer base` | 활성 button/a/[role=button]/label/summary |
| AC-10 disabled 제외 | `button:not(:disabled)` | disabled 미적용 |
| AC-R1 191 회귀 | 전체 스위트 | 191/191 유지(+4 신규 = 195) |
| AC-R2 ClockToggle 불변 | `ClockToggle.tsx` 1:1 리팩터 | 마크업/라벨/PATCH URL·body·헤더 불변, 훅 소비만 |
| AC-R3 날짜 셀 불변 | `MonthlyCalendar` | byDate/셀/라우트 로직 불변(reloadKey effect만 append) |
| AC-R4 빌드/하이드레이션 | build ✓ | mount-gate 로 `/attendance` static 유지, 경고 0 |

## 작업 로그 (TDD 사이클, 시간순)

| # | AC | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| C1 | AC-6(0건) | `clockPhase(null)` 미존재 → fail | `domain.ts clockPhase` 추가 → pass | 중복 없음(skip) |
| C2 | AC-3~5 | before/working/done 3 분기 테스트 | 기 구현이 전 분기 커버 → pass | — |

- C1/C2: `clockPhase`는 ClockToggle 인라인 phase 식(`!clockIn→before / !clockOut→working / else done`)을 순수 함수로 추출. UI/fetch 의존부(useTodayClock·ClockFab·뷰 배선·cursor)는 node 테스트 환경(DOM/RTL 없음)상 build/tsc/lint + ClockToggle 코드 diff 1:1(동작 불변) 로 검증(architect 지침).
- Horizontal slicing: ❌ (사이클별 RED→GREEN 1개씩).

## 산출물

| 파일 | 종류 | 변경 |
|---|---|---|
| `src/features/attendance/domain.ts` | 수정(append) | `clockPhase()` + `ClockPhase` 추출(단일 진실원) |
| `src/features/attendance/domain.test.ts` | 수정(append) | clockPhase 4 테스트 |
| `src/features/attendance/hooks/useAttendance.ts` | 수정(append) | `useTodayClock(date)` — ClockToggle 로직 1:1 이관, clockIn/clockOut record 반환 |
| `src/features/attendance/components/ClockToggle.tsx` | 수정 | useTodayClock 소비 리팩터(렌더/PATCH 불변, AC-R2) |
| `src/features/attendance/components/ClockFab.tsx` | 신규 | client mount-gate FAB, z-40, phase 라벨, onRegistered |
| `src/features/attendance/components/AttendanceCalendarView.tsx` | 수정 | ClockFab 마운트 + reloadKey 배선 |
| `src/features/attendance/components/MonthlyCalendar.tsx` | 수정(최소) | `reloadKey?` prop + effect reload(기존 로직 불변) |
| `src/app/globals.css` | 수정(append) | @layer base cursor:pointer 규칙 |
| `CONTEXT.md` | 수정 | 용어 1건 추가(ClockFab) + 홈 토글 스코프 보강 |

- 컨벤션 적용: feature-based 배치(architect §1), useSyncExternalStore mount-gate(HomeToday/BottomNav 패턴), authHeaders 크루 스코프.
- CONTEXT.md 추가 용어: 1건(**출퇴근 등록 FAB / ClockFab**). ADR: 불필요(PRD §10 — 기존 결정 연장).

## 자가 검증 (DoD, 직접 Bash)

- 단위 테스트: ✅ 195/195 (191 회귀 + 4 신규)
- 타입체크 `tsc --noEmit`: ✅ EXIT 0
- 빌드 `next build`: ✅ Compiled successfully, `/attendance` static 유지, 경고 0
- lint `eslint`: ✅ EXIT 0
- TDD 사이클: 2 (RED→GREEN). REFACTOR 불필요(중복 없음).
- Horizontal slicing: ❌ (vertical slice만).

## 경계면 일치 확인

- ClockFab ↔ useTodayClock: `clockIn()/clockOut()` → `Promise<AttendanceRecord|null>`, res 있으면 onRegistered.
- useTodayClock ↔ API: GET `/api/attendance/${date}`(no-store) · PATCH `/api/attendance?date=` `{field,time}` — **ClockToggle 기존과 URL/body/헤더 1:1**(신규 엔드포인트 0).
- AttendanceCalendarView ↔ MonthlyCalendar: `reloadKey:number` prop, effect→`useMonthAttendance.reload`(기존 반환).
- cursor base ↔ utility: `@layer base` → Tailwind utility(`cursor-not-allowed`) 우선, 충돌 0.

## 미충족 AC

없음. 전 AC 충족(UI 위치/스코프는 코드일치·build 검증).
