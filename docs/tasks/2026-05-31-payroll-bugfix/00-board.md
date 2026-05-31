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
| 구현 | developer | 🔄 진행중 | `04-implementation.md` |
| 리뷰 | reviewer+codex | 미시작 | `05-review.md` |

## 진행 로그
- 2026-05-31 — T3 시작. 사용자 의미 결정: P1 결근=정규전액차감, P2 실근무 인정(5/28=392분). 압축 파이프라인.
