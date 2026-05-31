# 02-approval — 승인 결정 (T4)

- **작성**: orchestrator (소형 확장 task — 별도 approver AI 에이전트 생략, 사용자 게이트 직행)
- **대상 PRD**: `01-prd.md`
- **상태**: ✅ APPROVED (사용자 컨펌 2026-05-31)

## 최종 사용자 결정
**판정: APPROVE**

| Q | 결정 | architect/developer 지침 |
|---|---|---|
| Q1 레코드 없는 날 수락 | **새 레코드 생성(upsert)** | 해당 날짜 레코드 없으면 after 값으로 신규 생성 후 반영. 404 아님. |
| Q2 재수락 | **멱등 no-op** | 이미 status=수락인 요청 재수락 시 현 상태 그대로 반환(에러 아님). |
| Q4 월 이동 UI | **‹ 월라벨 › 화살표** | 월 제목 양옆 이전/다음 화살표 버튼. 빈 달도 이동 가능. |
| Q3 수락 API 응답 | (architect 결정) | 권장: `{ request: EditRequest(수락), record: AttendanceRecord(갱신) }`. |

## 핵심 기술 결정 (PRD 반영)
- **연장 정합(T3 follow-up 해소)**: 연장 = `max(0, parseHHMM(clockOut) − REGULAR_END(900=15:00))`. 신규 `calcOvertimeByClock` 추가 후 `approveRequest`/`updateStatus`/`upsertTodayClock` 호출부 교체. 조기출근·정규내 근무는 연장 아님. seed 5/28(07:58~15:00) 런타임 재계산 시 overtime 0 유지 → 불변식②(6회/544분) 보존.
- 기존 export append-only, 기존 75 테스트 회귀 0.
