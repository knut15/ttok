# 리뷰 보고서 (v1)

- task: T13 — 홈 진행바 실제 출퇴근시각 라벨
- diff base: 3db7e60 → 705d9af
- 리뷰어: task-reviewer (teammate mode)
- 일시: 2026-06-01

---

## AC 매트릭스

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 4개
- file:line 증거: 4개
- test ID 증거: 4개
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 4/4 = 100%

| AC# | 내용 | 충족 증거 | 증거 유형 | 일치 |
|---|---|---|---|---|
| AC-1 | 근무중(working)일 때 좌측 라벨이 실제 출근시각 표기 ("14:30 ~") | domain.ts:56-58 `${record.clockIn} ~` / domain.test.ts:76-79 "working(근무중)은 실제 출근시각 + 퇴근 미정" PASS | file:line + test ID | ✅ |
| AC-2 | 마감(done)일 때 출근~퇴근 표기 ("14:30 ~ 15:30") | domain.ts:59 `${record.clockIn} ~ ${record.clockOut}` / domain.test.ts:81-85 "done(마감)은 실제 출근~퇴근" PASS | file:line + test ID | ✅ |
| AC-3 | 미출근(before, record 없음/clockIn 없음)일 때 정규시간 placeholder("08:00 ~ 15:00") 유지 | domain.ts:53-55 `REGULAR_RANGE.replace("~", " ~ ")` / domain.test.ts:66-74 2개 케이스 PASS | file:line + test ID | ✅ |
| AC-4 | 회귀 0 (기존 199 테스트 불변), 순수함수 테스트 | pnpm test: 203 passed / 23 test files. 구 199 + clockRangeLabel 신규 4 = 203 PASS | test run result | ✅ |

---

## 경계면 검증

### ClockToggle.tsx ↔ domain.ts clockRangeLabel

- 변경 전: `leftLabel={REGULAR_RANGE.replace("~", "-")}` (하드코딩)
- 변경 후: `leftLabel={clockRangeLabel(record, phase)}` (domain.ts:42 함수 호출)
- ClockToggle.tsx:6 `import { clockRangeLabel, longWorkLabel } from "@/features/attendance/domain"`
- 인자 shape: `record: AttendanceRecord | null` (useTodayClock 반환 그대로), `phase: ClockPhase`
- 반환 타입: `string` — ProgressBar `leftLabel?: string` prop과 일치
- 판정: **일치**

### domain.ts REGULAR_RANGE 상수 ↔ 실제 placeholder 출력

- `constants.ts:20` `REGULAR_RANGE = "08:00~15:00"` (물결표 공백 없음)
- `domain.ts:54` `.replace("~", " ~ ")` 로 `"08:00 ~ 15:00"` 생성
- test 기대값: `"08:00 ~ 15:00"` — 일치
- 판정: **일치**

### 불변 검증 — 진행바/headline/홈 상태/FAB/퇴근 confirm

- `percent` 계산 로직: ClockToggle.tsx:16-22 — diff에서 변경 없음
- `headline` 로직: ClockToggle.tsx:23-28 — 변경 없음
- `clockFabConfirm.test.ts`: 해당 파일 diff 변경 없음, 203 PASS에 포함
- ClockFab 관련 파일: diff에 미포함 (변경 없음)
- 판정: **불변 확인**

---

## 빌드/테스트 결과

- 빌드: ✅ `next build` — "Compiled successfully in 1834ms", 19/19 static pages 생성, 에러 없음
- tsc --noEmit: ✅ 출력 없음 (타입 오류 0)
- lint: ✅ eslint 경고/오류 없음
- 단위 테스트: ✅ 203 passed / 23 test files (0 failed)
  - clockRangeLabel 신규 4개: 전부 PASS
  - 기존 199개: 전부 PASS (회귀 0)

실행 로그 스니펫:
```
Test Files  23 passed (23)
     Tests  203 passed (203)
  Start at  13:17:18
  Duration  364ms
```

---

## 교차 검증 (codex review)

- 자체 판정 (하네스축): PASS
- codex 호출: `codex review --base 3db7e60`
- codex 버전: OpenAI Codex v0.135.0 / model: gpt-5.5
- 호출 결과 요약 (codex stdout 1행):
  > "The new label helper correctly maps before, working, and done states and is wired into ClockToggle without affecting other behavior. Targeted tests could not execute because the read-only sandbox blocked Vitest temp-directory creation, but inspection found no actionable regression."
- P1/P2 finding: 없음
- P3 (경미): 없음 ("no actionable regression" 명시)
- codex 판정: **PASS**
- 최종 결정: **PASS 확정** (하네스축 PASS AND 코드축 codex PASS)

비고: codex 샌드박스가 read-only라 Vitest 직접 실행은 차단됐으나, 코드 정적 검사로 "actionable regression 없음" 판정. 실제 테스트 실행은 하네스축에서 완료 (203 PASS).

---

## 최종 판정

- 판정: **PASS**
- 사유: AC-1~4 전부 충족, 경계면 일치, 빌드/tsc/lint/test 전부 GREEN(203 PASS, 회귀 0), codex 교차 검증 PASS(P1/P2 finding 없음)
- 회귀 지점: 없음 (종료 — Done)
- follow-up 후보: 없음
