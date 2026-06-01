# 04 구현 — 홈 진행바 우측 % 라벨, 퇴근 완료 후에만 노출

작성: 2026-06-01 / task-developer (teammate mode)

## 요구 요약
홈 진행바 우측 `${percent}%` 라벨을 `phase === "done"`(퇴근 완료) 후에만 노출.
`before`/`working` 시에는 미노출(빈 문자열). percent 계산·leftLabel·headline은 불변.

## AC 충족 매핑
- AC-1 (done 후에만 % 노출) → `src/features/attendance/domain.ts:46-48` `shouldShowPercent(phase)` 순수 판정 + `src/features/attendance/components/ClockToggle.tsx:47` `rightLabel={shouldShowPercent(phase) ? \`${percent}%\` : ""}`
- AC-2 (before/working 미노출) → 동일 함수 false 분기 → ProgressBar가 빈 `rightLabel`을 안전 처리(`<span>{""}</span>` 렌더, 텍스트 없음)

## 수정 파일 (파일:라인)
1. `src/features/attendance/domain.ts:43-48` — `shouldShowPercent(phase: ClockPhase): boolean` 신규 export (순수함수, `phase === "done"`).
2. `src/features/attendance/components/ClockToggle.tsx:6-10` — import에 `shouldShowPercent` 추가.
3. `src/features/attendance/components/ClockToggle.tsx:47` — `rightLabel` 조건부 (done → `${percent}%`, 그 외 → `""`).
4. `src/features/attendance/domain.test.ts` — import 확장 + `shouldShowPercent` describe 3 케이스 추가 (append-only).

## ProgressBar 안전 처리 확인
`src/components/ProgressBar.tsx:20` 가드 `(leftLabel || rightLabel)` — leftLabel(clockRangeLabel)이 항상 truthy이므로 라벨 행은 유지되고, `<span>{rightLabel}</span>`에 빈 문자열이 들어가 우측 텍스트만 사라진다. ProgressBar 변경 없음(최소 변경).

## TDD 사이클 (vertical slice)
| 사이클 | AC | RED | GREEN |
|---|---|---|---|
| 1 | AC-1/2 | `shouldShowPercent` 미존재 → 3 케이스 `TypeError: shouldShowPercent is not a function` (206 중 3 fail) | domain.ts에 순수함수 추가 → 206 GREEN |

- 컴포넌트 배선(ClockToggle import/rightLabel)은 모든 테스트 GREEN 상태에서 수행(REFACTOR/통합 단계). 인라인 조건 대신 순수함수 위임으로 표시 판정을 단일 진실원에 둠.
- Horizontal slicing 미사용. 내부 협력자 mock 없음.

## 자가 검증 (직접 Bash)
- 단위 테스트: ✅ 206/206 (베이스라인 203 → +3, 회귀 0)
- 타입체크 `tsc --noEmit`: ✅ clean
- 빌드 `pnpm build`: ✅ `Compiled successfully in 2.1s`
- 린트 `pnpm lint`: ✅ clean

## 경계면 일치
- domain ↔ component: `ClockPhase` 타입 단일 진실원 그대로 사용. `shouldShowPercent`는 `clockPhase`와 동일 phase 도메인 위에서 동작.
- component ↔ ProgressBar: `rightLabel?: string` 계약 유지. 빈 문자열 = 미표시.

## 불변 확인 (회귀 0)
leftLabel(`clockRangeLabel`)·percent 계산·headline·FAB·퇴근 confirm·홈 상태 로직 모두 미변경.
