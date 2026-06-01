# 03-architecture — 아키텍처 설계서 (T11: 출퇴근 등록 FAB + cursor pointer)

- task-architect / detected_stack react-nextjs / feature-based / append-only
- 확정: Q1 즉시등록 / Q2 마스터 FAB 노출(본인 스코프) / useTodayClock 훅 추출 / FAB z-40

## §1. 변경 범위 & 모듈 경계
| 파일 | 종류 | 책임 |
|---|---|---|
| `src/features/attendance/hooks/useAttendance.ts` | 수정(append) | `useTodayClock(date)` append — 오늘레코드 GET→phase→clockIn/clockOut PATCH. authHeaders, crewId dep, setRecord(null) 리셋. ClockToggle 인라인 1:1 이관 |
| `src/features/attendance/components/ClockToggle.tsx` | 수정 | useTodayClock 소비로 리팩터. 렌더/마크업/PATCH/라벨 불변(AC-R2) |
| `src/features/attendance/components/ClockFab.tsx` | 신규 | client 우하단 fixed FAB. useTodayClock(today), mount-gate, phase 라벨/disabled, z-40. onRegistered 콜백. 마스터 포함 노출 |
| `src/features/attendance/components/AttendanceCalendarView.tsx` | 수정 | ClockFab 마운트 + reloadKey 배선 |
| `src/features/attendance/components/MonthlyCalendar.tsx` | 수정(최소) | `reloadKey?: number` prop + `useEffect([reloadKey])`→reload(). 기존 로직 불변 |
| `src/app/globals.css` | 수정(append) | @layer base cursor:pointer 규칙 |

의존성: `useTodayClock`(단일 진실원) ← ClockToggle/ClockFab. ClockFab→AttendanceCalendarView(onRegistered)→MonthlyCalendar(reloadKey). 순환 0.

## §2. 데이터 흐름 & 계약
```typescript
type Phase = "before" | "working" | "done";
interface UseTodayClock {
  record: AttendanceRecord | null;
  phase: Phase;           // !clockIn→before, !clockOut→working, else done
  busy: boolean;          // PATCH in-flight 가드(E-2)
  clockIn: () => Promise<AttendanceRecord | null>;
  clockOut: () => Promise<AttendanceRecord | null>;
}
function useTodayClock(date: string): UseTodayClock;
```
- GET `/api/attendance/${date}`(no-store, authHeaders), PATCH `/api/attendance?date=${date}` {field, time:nowHHMM()}(authHeaders). **URL/body/헤더 기존 ClockToggle과 1:1**(회귀 0).
- effect deps `[date, crewId]`, crewId=user.crewId??user.id, 전환 시 setRecord(null) + active cleanup.
- 흐름: ClockFab onClick → phase별 clockIn()/clockOut() → PATCH(서버 enforceReadScope: 크루 본인강제/마스터 self) → setRecord → onRegistered → AttendanceCalendarView setReloadKey → MonthlyCalendar reload.
- **캘린더 갱신 = 안 A**: MonthlyCalendar에 reloadKey prop + effect로 기존 useMonthAttendance.reload 호출(records 끌어올리기=안 B는 scope creep, 불채택). API 계약 불변, 신규 엔드포인트 0, AttendanceRecord 재사용.

## §3. 알고리즘 & 복잡도
phase 판정 O(1), clock PATCH O(1), FAB 분기 O(1), byDate Map O(n≤31, 기존), cursor O(0 런타임). O(n²) 없음. 중첩≤3, 함수≤50줄. DRY=훅 단일 진실원.

## §4. 렌더링 & 권한
- ClockFab client, mount-gate(useSyncExternalStore, HomeToday 패턴) → mount 전 미렌더(todayDate build 고정 mismatch 회피, 하이드레이션 0).
- z-40 fixed 우하단: BottomNav z-30 < FAB z-40 < BottomSheet z-50. bottom 오프셋 BottomNav 바 위(비겹침).
- phase done → disabled, cursor base `:not(:disabled)` 제외.
- crewId dep 전환 무효화. no-store. cursor `@layer base`(SSR/CSR 동일, utility 우선이라 cursor-not-allowed 충돌 0).

## 체크리스트
- [x] useTodayClock 추출 ClockToggle 동작 불변 [x] FAB 크루 스코프 [x] z-40 비겹침 [x] 등록 후 캘린더 갱신(reloadKey) [x] cursor base disabled 제외 [x] 회귀0·append-only [x] RSC/client·하이드레이션

## developer 인계
1. `useTodayClock(date)`를 `hooks/useAttendance.ts`에 append(별도파일X). ClockToggle 로직 URL/body/헤더 1:1 이관, ClockToggle은 훅 소비로만 리팩터(동작 불변).
2. 캘린더 갱신=안 A: MonthlyCalendar `reloadKey?` prop + effect reload. AttendanceCalendarView ClockFab onRegistered→setReloadKey. (안 B records 끌어올리기 금지.)
3. ClockFab client+mount-gate, fixed z-40 우하단(BottomNav z-30 위), done disabled, 마스터 포함 무조건 노출(authHeaders가 self 스코프).
4. globals.css @layer base `button:not(:disabled), a, [role="button"], label, summary { cursor: pointer; }`.
5. clockIn/clockOut이 record 반환 → res.ok 시에만 onRegistered. 신규 AC 테스트 + 191 회귀 + 하이드레이션 0.
