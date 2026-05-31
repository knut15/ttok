# 📋 Task Board — TODAY 실제날짜 버그수정 (T6)

> teammate / 압축 파이프라인(스펙→구현→리뷰) / 버그수정

## 범위
- 홈 `page.tsx`의 하드코딩 `TODAY="2026-05-29"` → **실제 현재 날짜**(클라 계산, 하이드레이션·타임존 안전).
- 결과: 오늘(5/31) 표기 + 오늘 출퇴근 토글 가능.
- `js month 오류 아님` 확인 — 하드코딩 상수가 원인.

## 단계
| Phase | 역할 | 상태 | 산출물 |
|---|---|---|---|
| 스펙 | orchestrator | ✅ | `01-prd.md` |
| 구현 | developer | 🔄 진행중 | `04-implementation.md` |
| 리뷰 | reviewer+codex | 미시작 | `05-review.md` |

## 진행 로그
- 2026-05-31 — T6 시작. 원인=page.tsx 하드코딩 TODAY. 수정=실제 현재날짜(client).
