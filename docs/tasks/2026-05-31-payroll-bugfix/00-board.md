# 📋 Task Board — Crewmon 급여 버그수정 (T3)

> **운영 모드**: teammate / 기존 repo / **압축 파이프라인**(스펙→구현→리뷰; 스코프 명확·사용자 승인 완료로 planner/approver/architect 생략)
> **출처**: T2 리뷰 중 codex가 발견한 T1 코드 결함 (P1 급여 + P2 시드 정합성)

## 범위 (사용자 결정 반영)
- **P1** `src/lib/store.ts` `updateStatus`: 결근 전환 시 deduct가 0으로 리셋되는 버그 → **결근=정규 전액 차감**(deduct=390, work=0), 휴가=work0·deduct0(구분).
- **P2** `src/lib/seed.ts` 5/28: clock 07:58→15:00 실근무 392분인데 workMinutes=390 하드코딩 → **실근무 그대로 인정**(392분, 일급 67,424원). 출근시각(07:58)은 실제 입력값이므로 유지.
- **제외**: T1 잔여 P2(requests after 검증, store else break) — 별도 follow-up.

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 스펙 | orchestrator | ✅ | `01-prd.md` |
| 구현 | developer | ✅ 완료 | `04-implementation.md` (75 test, 커밋 d411bed) |
| 리뷰 | reviewer+codex | ✅ PASS | `05-review.md` (AC 6/6, codex 코드축 PASS) |

## 진행 로그
- 2026-05-31 — T3 시작. 사용자 의미 결정: P1 결근=정규전액차감, P2 실근무 인정(5/28=392분). 압축 파이프라인.
- 2026-05-31 — 구현(75 test, 커밋 d411bed) → 리뷰 PASS (rework 0). ✅ T3 Done.

---

# 🎉 Task 최종 결과 — T3 (급여 버그수정)

## 결과
- **P1 해소**: `updateStatus` 결근 전환 시 deduct=390(정규 전액 차감), 휴가와 분리. 급여 과다지급 버그 수정.
- **P2 해소**: seed 5/28 workMinutes 390→392(실근무 인정), 일급 67,424원.
- **검증**: 75 테스트 GREEN(회귀 0, 5/28 금액 의도적 갱신만), tsc/build/lint 0. codex 코드축 PASS.
- **커밋**: `d411bed` (main).

## ⚠️ 신규 follow-up (T4 후보, P2)
- `updateStatus`의 정상/연장 분기가 `calcOvertime(workMinutes)`로 연장을 재계산 → 5/28(392분)을 상태 재저장하면 overtime 0→2로 바뀌어 연장 합계(544분) 틀어짐. **"실근무 인정(392)" vs "연장=정규초과분" 규칙 충돌.** 해결: 연장을 정시 퇴근(15:00) 초과분 기준으로 재정의(clockOut 기반)하거나, 정규 미세초과(조기출근分)는 연장 제외. 회귀 테스트 추가 필요.

## 관련 산출물
- `docs/tasks/2026-05-31-payroll-bugfix/{01-prd,04-implementation,05-review}.md`, `CONTEXT.md`(차감/실근무 정책 추가)
