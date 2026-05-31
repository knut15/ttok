# 02-approval — 승인 결정 (T5)

- **작성**: orchestrator (소형 UI 확장 — 사용자 게이트 직행)
- **대상**: `01-prd.md`
- **상태**: ✅ APPROVED (2026-05-31)

## 최종 사용자 결정: APPROVE

| Q | 결정 | 지침 |
|---|---|---|
| Q1 월 picker 범위 | **입사월~현재월** | 입사월 = `storeInfo.joinDate`(2026-04) 기준, 현재월 = `SEED_MONTH`(2026-05, 데모 기준월). picker는 2026-04~2026-05만 노출. 미래·입사전 제외. 범위 경계는 상수/storeInfo에서 도출(하드코딩 회피). |
| Q3 일자 이동 범위 | **무제한 허용** | `/attendance/[date]` 이전/다음은 제한 없이 ±1일. 기록 없는 날은 기존 "근무기록이 없습니다" 빈 상태(graceful). |
| Q2 뒤로 버튼 배치 | (architect 결정) | 권장: AppHeader에 `left` 슬롯 append 또는 상세 client 래퍼 상단 ‹ 버튼. 기존 호출 회귀 없게. |

## 기술 제약
- append-only, 기존 106 테스트 회귀 0, RSC/client 경계, `shiftDay` 순수함수+테스트(UTC 함정 회피 문자열 계산).
- T4의 ‹ › 화살표와 월 picker 병존.
