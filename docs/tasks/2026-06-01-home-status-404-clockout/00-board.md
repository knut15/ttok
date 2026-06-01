# 📋 Task Board — 홈 상태전용 + 404→200 + 퇴근 확인 (T12)

> teammate / 압축 파이프라인(스펙→구현→리뷰) / 2026-06-01

## 범위 (사용자 결정)
- B 홈 출퇴근 버튼 제거(상태만, 등록은 FAB 일원화)
- C `GET /api/attendance/[date]` 기록없음 → 404 대신 200+null
- D 퇴근(clockOut) 시 현재시각 확인 대화상자 후 처리(출근은 즉시)

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 스펙 | orchestrator | ✅ | `01-prd.md` |
| 구현 | developer | ✅ 완료 | `04-implementation.md` (198 test, 커밋 2d1982d) |
| 리뷰 | reviewer+codex | 🔄 진행중 | `05-review.md` |

## 진행 로그
- 2026-06-01 — T12 시작(B+C+D). 다음: T13 과거기록 추가→승인대기.
