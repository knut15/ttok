# 구현 노트 (T13) — 홈 진행바 실제 출퇴근시각 표기

## AC 충족 매핑
- AC-1 (working → 실제 출근시각, 퇴근 미정 "14:30 ~"): `src/features/attendance/domain.ts:50-52` (`clockRangeLabel` working 분기) + `ClockToggle.tsx:42` leftLabel 연결
- AC-2 (done → "14:30 ~ 15:30"): `src/features/attendance/domain.ts:54` (done 분기)
- AC-3 (before/clockIn 없음 → 정규 placeholder "08:00 ~ 15:00"): `src/features/attendance/domain.ts:48-49` (`REGULAR_RANGE.replace("~", " ~ ")`)
- AC-4 (회귀 0, 순수함수 테스트): `domain.test.ts` 4 케이스 추가, 기존 199 불변

## 수정 (파일:라인)
- `src/features/attendance/domain.ts`
  - L5 import에 `REGULAR_RANGE` 추가
  - L43-56 `clockRangeLabel(record, phase)` 순수함수 append (부수효과 0)
- `src/features/attendance/components/ClockToggle.tsx`
  - L5 import에서 `REGULAR_RANGE` 제거, L6 `clockRangeLabel` 추가
  - L42 `leftLabel={REGULAR_RANGE.replace("~", "-")}` → `leftLabel={clockRangeLabel(record, phase)}`
- `src/features/attendance/domain.test.ts`
  - L2 import `clockRangeLabel` 추가
  - `clockRangeLabel` describe 블록 4 케이스 추가 (before / clockIn null / working / done)

진행바 percent·headline·홈 상태표시(T12, 버튼 없음)·FAB·퇴근confirm·크루스코프 전부 불변. append-only.

## TDD 사이클 (vertical slice 1사이클)
| 단계 | 내용 | 결과 |
|---|---|---|
| RED | `clockRangeLabel` 4 케이스 작성 후 `pnpm test domain.test` | 4 fail ("clockRangeLabel is not a function") |
| GREEN | domain.ts 최소 구현 append | 17/17 pass |
| REFACTOR | 추가 정리 불필요(단일 순수함수, 중복 없음) | — |

`clockRangeLabel`은 단일 AC 묶음(라벨 산출)의 sub-behavior 4종을 한 함수가 책임 → 1 vertical slice. mock 0 (순수함수, 시스템 경계 없음).

## 자가 검증 (DoD, 직접 Bash 실행)
- 단위 테스트: 23 files / 203 passed (기존 199 + 신규 4) ✅
- 타입체크: `tsc --noEmit` exit 0 ✅
- 빌드: `pnpm build` 성공 ✅
- lint: `pnpm lint` clean ✅
- 회귀: 199 → 203 (감소 0, 기존 전부 GREEN) ✅

## 경계면 일치 확인
- domain ↔ ClockToggle: `clockRangeLabel(record: AttendanceRecord | null, phase: ClockPhase): string`. record/phase는 `useTodayClock(date)`가 이미 반환하던 값 그대로 전달 → 신규 prop/fetch 없음.
- placeholder 포맷: AC-3 "08:00~15:00"를 ProgressBar 가독성 위해 `" ~ "`로 정규화(스펙 "정규 placeholder 유지" 충족). working/done도 동일 `" ~ "` 구분자로 일관.
