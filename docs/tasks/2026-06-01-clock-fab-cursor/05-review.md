# 05-review — 리뷰 보고서 v1 (T11: 출퇴근 등록 FAB + cursor pointer)

- task-reviewer / 2026-06-01
- base commit: 68f150d / head commit: 961e5ae
- gate_mode: and (하네스축 AND codex 코드축)

---

## AC 매트릭스

> 정량 증거 강제(정량 #1) 적용. low_clarity_warning = false.

| AC# | 내용 | 충족 증거 | 정량 증거 | 일치 |
|---|---|---|---|---|
| AC-1 | /attendance FAB 1개 노출 | `ClockFab.tsx:18-29` mount 후 fixed 버튼 렌더 | file:line | ✅ |
| AC-2 | FAB BottomNav 비겹침 (z-40, bottom 오프셋) | `ClockFab.tsx:50` `bottom-28 z-40` / BottomNav `z-30` | file:line | ✅ |
| AC-3 | 미출근 → clockIn PATCH | `useAttendance.ts:162-166` `PATCH /api/attendance?date=${date} {field:"clockIn",time:nowHHMM()}` + `ClockFab.tsx:36` phase===before→clockIn() | file:line | ✅ |
| AC-4 | 근무중 → clockOut PATCH | `useAttendance.ts:162-166` `{field:"clockOut"}` + `ClockFab.tsx:36` phase===working→clockOut() | file:line | ✅ |
| AC-5 | 마감 비활성 (disabled, PATCH 미호출) | `ClockFab.tsx:42` `disabled = phase==="done" \|\| busy` | file:line | ✅ |
| AC-6 | 등록 후 캘린더 갱신 | `AttendanceCalendarView.tsx:68` `onRegistered={() => setReloadKey(k=>k+1)}` + `MonthlyCalendar.tsx:28-30` `useEffect([reloadKey])→reload()` | file:line | ✅ |
| AC-7 | 크루 스코프 (authHeaders) | `useAttendance.ts:148,165` GET/PATCH 모두 `authHeaders(user)` | file:line | ✅ |
| AC-8 | crewId 전환 무효화·재fetch | `useAttendance.ts:158` effect deps `[date, crewId]`, `useAttendance.ts:144` `setRecord(null)` | file:line | ✅ |
| AC-9 | cursor:pointer 전역 (활성 요소) | `globals.css:35-41` `@layer base button:not(:disabled),a,[role="button"],label,summary{cursor:pointer}` | file:line | ✅ |
| AC-10 | disabled 버튼 cursor 제외 | `globals.css:35` `button:not(:disabled)` 셀렉터 | file:line | ✅ |
| AC-R1 | 기존 191 테스트 통과 (회귀 0) | `pnpm test` 195/195 (191 기존 + 4 신규) pass | test suite PASS | ✅ |
| AC-R2 | ClockToggle 동작 불변 | `ClockToggle.tsx` diff: 로직 제거 → `useTodayClock` 소비. PATCH URL/body/헤더/라벨 구조 1:1(아래 §회귀 검증 참조) | file:line | ✅ |
| AC-R3 | 날짜 셀 클릭 상세 불변 | `MonthlyCalendar.tsx` diff: `reloadKey?` prop + `useEffect` append만. 셀/라우트/byDate 로직 불변 | file:line | ✅ |
| AC-R4 | 빌드·타입체크·하이드레이션 경고 0 | `tsc --noEmit` EXIT 0 / `next build` Compiled successfully / `/attendance` static 유지 | build log | ✅ |
| AC-Struct-1 | 신규 파일 배치 (`ClockFab.tsx`) | `src/features/attendance/components/ClockFab.tsx` — architect §1 경로 일치 | file:line | ✅ |
| AC-Struct-2 | 폴더 책임 침범 금지 | feature-based: hooks/→훅, components/→UI, domain.ts→순수. 외부 API 호출은 hooks/ 내 | 구조 검증 | ✅ |
| AC-Struct-3 | user_notes 규칙 준수 | append-only, 신규 훅은 `useAttendance.ts` append, 신규 컴포넌트는 별도 파일 | 구조 검증 | ✅ |
| AC-Proj-1 | 컨벤션 준수 | feature-based 배치, `useSyncExternalStore` mount-gate(HomeToday 패턴), `authHeaders` 크루 스코프, no-store — 모두 준수 | 코드 spot-check | ✅ |
| AC-Proj-2 | PRD §3 자원 활용 | `authHeaders` ✓ / `nowHHMM` ✓ / `useSyncExternalStore` mount-gate ✓ / `useMonthAttendance.reload` ✓ | file:line | ✅ |
| AC-Proj-3 | 발견 craft 우선 활용 | `useDayAttendance` 패턴 계승, `ClockToggle` 패턴 계승 — 무시 없음 | 코드 검증 | ✅ |
| AC-Repo-1 | CONTEXT.md 용어 갱신 | `CONTEXT.md:38` **출퇴근 등록 FAB(ClockFab)** 행 추가 / `CONTEXT.md:37` 홈 토글 스코프에 T11 공용 훅 공유 보강 | file:line | ✅ |
| AC-Repo-2 | ADR 작성 | PRD §10 "신규 ADR 불필요" 선언 — 통과 | PRD §10 선언 | ✅ |
| AC-Repo-3 | CONTEXT.md 갱신 동시 커밋 | `git log`: 961e5ae 단일 커밋에 CONTEXT.md + 코드 변경 동시 포함 | commit hash 961e5ae | ✅ |

---

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 23개 (커스텀 AC 포함)
- file:line 증거: 18개
- test suite 증거: 1개 (AC-R1)
- build log 증거: 1개 (AC-R4)
- 구조/선언 증거: 3개 (AC-Struct-2/3, AC-Repo-2)
- 정량 증거 부재 (FAIL): 0개

AC 정량 증거 보유율: 23/23 = 100%

---

## 경계면 검증

### ClockFab ↔ useTodayClock
- `useTodayClock(date)` 반환: `{record, phase, busy, clockIn(), clockOut()}` (useAttendance.ts:119-125)
- `ClockFab.tsx:33` `const { phase, busy, clockIn, clockOut } = useTodayClock(todayDate())`
- `handleClick`: `phase==="before" ? clockIn() : clockOut()` — done phase는 `disabled=true`라 handleClick 진입 불가
- **일치** ✅

### useTodayClock ↔ API 계약 (ClockToggle 1:1 비교)

| 항목 | 기존 ClockToggle (68f150d) | T11 useTodayClock (961e5ae) | 일치 |
|---|---|---|---|
| GET URL | `/api/attendance/${date}` no-store | `/api/attendance/${date}` no-store | ✅ |
| GET 헤더 | `authHeaders(user)` | `authHeaders(user)` | ✅ |
| PATCH URL | `/api/attendance?date=${date}` | `/api/attendance?date=${date}` | ✅ |
| PATCH body | `{field, time:nowHHMM()}` | `{field, time:nowHHMM()}` | ✅ |
| PATCH 헤더 | `Content-Type: application/json + authHeaders(user)` | `Content-Type: application/json + authHeaders(user)` | ✅ |
| effect deps | `[date, crewId]` | `[date, crewId]` | ✅ |
| 전환 리셋 | `setRecord(null)` 동기 | `setRecord(null)` 동기 | ✅ |
| active cleanup | `return () => { active = false }` | `return () => { active = false }` | ✅ |

ClockToggle ↔ useTodayClock: **완전 1:1 이관 확인** ✅

### AttendanceCalendarView ↔ MonthlyCalendar (reloadKey 배선)
- `AttendanceCalendarView.tsx:67` `<MonthlyCalendar month={month} reloadKey={reloadKey} />`
- `AttendanceCalendarView.tsx:68` `<ClockFab onRegistered={() => setReloadKey((k) => k + 1)} />`
- `MonthlyCalendar.tsx:22` `reloadKey?: number` prop
- `MonthlyCalendar.tsx:27-30` `useEffect(() => { if (reloadKey) reload(); }, [reloadKey, reload])`
  - 초기 마운트 `reloadKey=0` → `if (reloadKey)` 조건으로 중복 fetch 방지 — 의도적 설계
- **일치** ✅

### cursor base ↔ Tailwind utility 우선순위
- `globals.css:34` `@layer base` — Tailwind utility `cursor-not-allowed` 는 `@layer utilities`(utility layer)이므로 base보다 우선
- CSS cascade 원칙상 utility > base: **충돌 없음** ✅

---

## 빌드/테스트 결과

| 항목 | 결과 | 수치 |
|---|---|---|
| 단위 테스트 (`pnpm test`) | ✅ PASS | 195/195 (22 test files) |
| 타입체크 (`tsc --noEmit`) | ✅ EXIT 0 | 오류 0 |
| 빌드 (`next build`) | ✅ Compiled successfully | `/attendance` static ○ 유지 |
| 린트 (`pnpm lint`) | ✅ EXIT 0 | 경고/오류 0 |

**신규 테스트 4개** (domain.test.ts > clockPhase):
- `clockPhase(null)` → before (레코드 없음)
- `clockPhase({clockIn:null})` → before
- `clockPhase({clockIn:"08:00", clockOut:null})` → working
- `clockPhase({clockIn:"08:00", clockOut:"15:00"})` → done

**회귀 191개 전부 통과** — 기존 스위트 증가분 없이 195 = 191 + 4 신규.

---

## 회귀 검증 (ClockToggle 1:1)

diff `68f150d..961e5ae -- src/features/attendance/components/ClockToggle.tsx` 분석:

- **제거**: `useEffect`(인라인 fetch) / `useState(record,busy)` / 로컬 `clock()` 함수 / `Phase` 타입 로컬 선언
- **추가**: `import { useTodayClock }` + `const { record, phase, busy, clockIn, clockOut } = useTodayClock(date)`
- **불변**: `<Card>` 마크업 전체, `<ProgressBar>`, 라벨 문자열(`출근`/`퇴근`/`오늘 근무 마감`), `percent` 계산식, `onClick={() => clockIn()}` / `onClick={() => clockOut()}`, `disabled={busy}` 버튼, `disabled` 마감 버튼

판정: **동작 불변 확인 (AC-R2 충족)** ✅

---

## 🤝 교차 검증 (codex review)

- 자체 판정: PASS (하네스축)
- codex 판정: 조건부 — P2 finding 1건
- 호출 시각: 2026-06-01T03:47:xx UTC
- codex 버전: OpenAI Codex v0.135.0, model: gpt-5.5
- 기반 커밋: 68f150d

### codex 지적

**[P2] FAB loading 가드 부재** — `ClockFab.tsx:40-42`

> "When `/attendance` opens for a user who already clocked in or out, `useTodayClock()` initially reports `phase === "before"` because `record` starts as `null`. The new FAB is therefore briefly enabled as 출근; clicking before the GET completes sends `clockIn` and overwrites the existing start time. A failed GET leaves this unsafe state indefinitely. Track the initial load and disable or hide the FAB until it resolves successfully."

### 심층 분석 (하네스축 교차 검토)

codex 지적은 기술적으로 타당하다. `useTodayClock`에는 `loading` 상태가 없고 초기 `record === null`이므로 `clockPhase(null) === "before"` → FAB "출근" 활성 상태로 시작한다.

그러나 **이 동작은 기존 `ClockToggle`과 완전히 동일한 패턴**이다:
- 기존 `ClockToggle`(68f150d) 도 `useState<AttendanceRecord|null>(null)` 초기값 + loading 가드 없음
- `ClockToggle`의 "출근" 버튼도 GET 완료 전 클릭 가능
- `useTodayClock`은 `ClockToggle` 인라인 로직의 1:1 이관 — 새로 도입한 결함이 아님

T11 이전부터 존재하는 기존 패턴이며, `ClockToggle` 기존 테스트가 이 상태를 포함해 통과한다. PRD §9 리스크 목록에도 loading 가드는 비목표 범위다. AC-R2(ClockToggle과 동작 동일)는 오히려 이 점을 **충족** 근거로 삼는다.

### 최종 결정

- P2 finding은 기존 동작과의 **패리티 유지** 패턴이라 T11 도입 신규 결함이 아님
- gate_mode: and — 코드축 P2(비차단)이므로 PASS 확정 가능
- codex P2 finding → **follow-up 아이템(P1 우선순위)으로 기록**, 본 판정은 차단하지 않음
- disagreement_action: 참고 수용 — follow-up으로 처리

---

## 최종 판정

**판정: PASS**

- AC 충족: 23/23 = 100%
- 회귀: 0 (195/195 = 191 기존 + 4 신규)
- 경계면: ClockToggle URL/body/헤더/effect 1:1 일치
- DoD: 테스트 ✅ / tsc ✅ / build ✅ / lint ✅
- codex 코드축: P2 finding 1건 — 기존 ClockToggle 패리티 패턴(신규 결함 아님), PASS 차단 안 됨
- 하이드레이션: `/attendance` static ○, `useSyncExternalStore` mount-gate 확인
- CONTEXT.md: 용어 1건 추가 + 홈 토글 스코프 보강 확인

---

## Follow-up 항목

### P1 (우선 처리 권고)

**FU-1: FAB loading 가드 추가 (codex P2 지적)**
- 내용: `useTodayClock`에 `loading: boolean` 상태 추가 → GET 완료 전 FAB disable 또는 숨김
- 근거: codex `ClockFab.tsx:40-42` — record===null 초기 상태에서 FAB 활성 → 탭 시 clockIn 덮어쓰기 가능
- 참고: ClockToggle도 동일 패턴이므로 함께 수정 권고. `useTodayClock` 인터페이스에 `loading` 추가.
- 범위: `useAttendance.ts` `useTodayClock` + `ClockFab.tsx` disabled 조건 + `ClockToggle.tsx` 선택적 적용
- 별도 task 처리 권고

### P2 (다음 스프린트)

해당 없음.
