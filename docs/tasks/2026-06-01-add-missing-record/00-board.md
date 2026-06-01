# 📋 Board — 과거 누락 근무기록 추가→승인대기 (T15)
> teammate / feature-based
범위: 기록 없는(과거) 날짜에서 크루가 출/퇴근·상태를 직접 입력 → 수정요청(대기) 생성 → 마스터 수락 시 레코드 생성(approveRequest upsert 재사용).
| Phase | 역할 | 상태 |
|---|---|---|
| 1 기획 | planner | 🔄 |
| 2 승인 | user gate | 미시작 |
| 2.5 아키텍처 | architect | 미시작 |
| 3 구현 | developer | 미시작 |
| 4 리뷰 | reviewer+codex | 미시작 |
- 2026-06-01 T15 시작.

# 🎉 T15 PASS (rework 0): 빈날짜 AddRecordForm(미래거부)→수정요청(대기)→마스터 수락 upsert 생성. Q5 역전400. store 무변경. 226 test, codex PASS. 커밋 0116211.
