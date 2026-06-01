# 리뷰 보고서 (v1)

- task: T14 — 홈 진행바 % 퇴근 후 노출
- diff base: 705d9af -> c7b1d65
- 리뷰어: task-reviewer (teammate mode)
- 일시: 2026-06-01

---

## AC 매트릭스

## AC 정량 증거 검증 (정량 #1)

- 전체 AC: 4개
- file:line 증거: 4개
- test ID 증거: 3개
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 4/4 = 100%

| AC# | 내용 | 충족 증거 | 증거 유형 | 일치 |
|---|---|---|---|---|
| AC-1 | done(퇴근 완료)일 때 우측 % 라벨 노출 | domain.ts:48 `return phase === "done"` + ClockToggle.tsx:47 `rightLabel={shouldShowPercent(phase) ? \`${percent}%\` : ""}` + domain.test.ts:95-97 "done이면 % 라벨 노출" PASS | file:line + test ID | ✅ |
| AC-2 | before(미출근)일 때 % 라벨 미노출 | domain.ts:48 false 분기 + domain.test.ts:99-101 "before이면 % 라벨 미노출" PASS | file:line + test ID | ✅ |
| AC-3 | working(근무중)일 때 % 라벨 미노출 | domain.ts:48 false 분기 + domain.test.ts:103-105 "working이면 % 라벨 미노출" PASS | file:line + test ID | ✅ |
| AC-4 | leftLabel/percent/headline/FAB/퇴근confirm 불변 (회귀 0) | pnpm test: 206 passed / 23 files. 베이스라인 203 + shouldShowPercent 3케이스 = 206. ClockToggle.tsx:20-32 percent/headline 로직 diff 미변경. | test run result + file:line | ✅ |

---

## 경계면 검증

### domain.ts shouldShowPercent ↔ ClockToggle.tsx rightLabel

- `domain.ts:48` `shouldShowPercent(phase: ClockPhase): boolean` — `phase === "done"` 순수함수
- `ClockToggle.tsx:47` `rightLabel={shouldShowPercent(phase) ? \`${percent}%\` : ""}`
- import: `ClockToggle.tsx:6-10` `shouldShowPercent` 명시적 import
- `ClockPhase` 타입: `domain.ts:29` 단일 진실원. `useTodayClock` 반환 phase와 동일 타입.
- 판정: **일치**

### ClockToggle.tsx rightLabel ↔ ProgressBar.tsx rightLabel prop

- `ProgressBar.tsx:8` `rightLabel?: string` (optional)
- `ClockToggle.tsx:47` 전달값: `shouldShowPercent(phase) ? \`${percent}%\` : ""`  — string 타입 일치
- `ProgressBar.tsx:20` 가드 `(leftLabel || rightLabel)` — leftLabel이 `clockRangeLabel` 반환값(항상 truthy string)이므로 라벨 행 유지됨
- `ProgressBar.tsx:25` `<span>{rightLabel}</span>` — 빈 문자열 = 텍스트 미렌더, 행 레이아웃 유지
- 판정: **일치, 빈 rightLabel 안전**

### 불변 검증 — percent/headline/leftLabel/FAB/퇴근confirm

- `ClockToggle.tsx:20-26` percent 계산 (`phase === "done"` 기반): diff 변경 없음
- `ClockToggle.tsx:27-32` headline 로직: diff 변경 없음
- `ClockToggle.tsx:45-46` `leftLabel={clockRangeLabel(record, phase)}`: diff 변경 없음
- `ClockFab.tsx`, `clockFabConfirm.ts`, `clockFabConfirm.test.ts`: diff에 미포함, 206 PASS에 기존 203 포함
- 판정: **불변 확인**

---

## 빌드/테스트 결과

- 빌드: ✅ `next build` — "Compiled successfully in 2.3s", 19/19 static pages, 오류 0
- tsc --noEmit: ✅ 출력 없음 (타입 오류 0)
- lint: ✅ eslint 경고/오류 없음
- 단위 테스트: ✅ 206 passed / 23 test files (0 failed)
  - shouldShowPercent 신규 3케이스: 전부 PASS
  - 기존 203케이스: 전부 PASS (회귀 0)

실행 로그 스니펫:
```
Test Files  23 passed (23)
     Tests  206 passed (206)
  Start at  13:23:18
  Duration  420ms
```

---

## 교차 검증 (codex review)

- 자체 판정 (하네스축): PASS
- codex 호출: `codex review --base 705d9af`
- codex 버전: OpenAI Codex v0.135.0 / model: gpt-5.5
- 호출 결과 요약 (codex stdout 핵심):
  > "The conditional percent-label behavior matches the stated requirement and preserves existing progress-bar layout. Type checking passed; Vitest could not run because the read-only sandbox blocked its temporary directory creation."
- P1 finding: 없음
- P2 finding: 없음
- P3 (경미): 없음
- codex 판정: **PASS**
- 최종 결정: **PASS 확정** (하네스축 PASS AND 코드축 codex PASS)

비고: codex 샌드박스 read-only 제약으로 Vitest 직접 실행 차단됨. 코드 정적 검사로 "requirement 충족, layout 불변" 확인. 실제 테스트 실행은 하네스축에서 완료 (206 PASS).

---

## 최종 판정

- 판정: **PASS**
- 사유: AC-1~4 전부 충족 (정량 증거 100%). shouldShowPercent 순수함수가 done/before/working 3케이스를 정확히 분기. ClockToggle rightLabel 경계면 일치. ProgressBar 빈 rightLabel 안전. 빌드/tsc/lint/test 전부 GREEN (206 PASS, 회귀 0). codex 교차 검증 PASS (P1/P2 finding 없음).
- 회귀 지점: 없음 (종료 — Done)
- follow-up 후보: 없음
