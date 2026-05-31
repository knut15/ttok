# 구현 노트 (T3) — 급여 버그수정

- **작성**: task-developer
- **유형**: 버그수정 (TDD, 범위 한정)
- **PRD**: `01-prd.md` (AC-T3-1 ~ AC-T3-6)

## AC 충족 매핑

| AC | 변경점 | 검증 |
|---|---|---|
| AC-T3-1 | `src/lib/store.ts:84-94` 결근 분기 분리 — `deductMinutes=REGULAR_MINUTES(390)`, work/overtime/break=0, clock 보존 | `store.test.ts` "'결근'으로 전환 시 정규 전액 차감…" |
| AC-T3-2 | `src/lib/store.ts:95-105` 휴가 분기 — deduct=0, work/overtime/break=0 (기존 동작 유지) | `store.test.ts` "'정상'→'휴가' 전환…" (기존 GREEN 유지) |
| AC-T3-3 | `src/lib/store.ts` 정상/연장/지각 분기 무변경 — v3 동작 회귀 0 | `store.test.ts` 지각→정상/연장 deduct=0, 지각 유지 보존 (기존 GREEN) |
| AC-T3-4 | `src/lib/seed.ts:59` 5/28 `workMinutes: 390→392` | `seed.test.ts` "④ 5/28 실근무 392분…amount 67424" |
| AC-T3-5 | seed 불변식 ①440 ②6회/544 ③totalPay=Σitems — 무변경, 기존 GREEN | `seed.test.ts` ①②③ |
| AC-T3-6 | `src/app/api/pay/[date]/route.test.ts:14-24` 5/28 단정값 67080→67424 의도적 갱신 | DoD 전체 GREEN |

## 수정 2건 (파일:라인)

### P1 — `src/lib/store.ts` `updateStatus` 결근/휴가 분리
- `import` 라인 16: `REGULAR_MINUTES` 추가.
- `if (status === "휴가" || status === "결근")` 단일 분기를 **결근 분기 / 휴가 분기**로 분리.
  - 결근: `deductMinutes = REGULAR_MINUTES`(390), work/overtime/break=0, clock 보존.
  - 휴가: deduct=0, work/overtime/break=0 (기존 동작 그대로).
- 정상/연장/지각 분기는 **무변경** (v3 회귀 방지). JSDoc만 정책 반영해 갱신.

### P2 — `src/lib/seed.ts` 5/28 실근무 인정
- `SEED_ROWS` "28" 행 `workMinutes: 390 → 392` (07:58~15:00 = 422분 − 휴게 30 = 392).
- `overtimeMinutes: 0` 유지(정시 퇴근), `status: "정상"` 유지, `clockIn: "07:58"` 유지.
- `buildPayItems`는 정규 캡 로직 없음 — `calcPaidMinutes(392,0)=392` → `calcDailyPay = round(392/60×10320) = 67424` 자동 산출. 코드 변경 불요(확인만).

## TDD 사이클 (vertical slice)

| 사이클 | AC | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 1 | AC-T3-1 | 결근 deduct=390 단정 → `expected +0 to be 390` 실패 캡처 | store.ts 결근 분기 분리 → 12 passed | 불요(최소 분리가 곧 정리형) |
| 2 | AC-T3-4 | 5/28 work 392·amount 67424 단정 → `expected 390 to be 392` 실패 캡처 | seed.ts 390→392 → 5 passed | 불요 |

- AC-T3-2/3/5는 기존 테스트가 새 동작에서도 GREEN 유지됨을 회귀 검증(분기 분리가 휴가·정상·연장·지각 경로를 건드리지 않음).
- Horizontal slicing 미사용. 내부 협력자 mock 미사용(순수 함수 + store 직접 호출).

## 의도적 테스트 갱신 (AC-T3-6)
- `src/app/api/pay/[date]/route.test.ts`: 5/28을 샘플 날짜로 쓰던 케이스가 stale 390/67080 단정 → 392/67424로 갱신. 테스트 의도(amount = paidMinutes × wage)는 보존, 수치만 실근무 반영.
- 그 외 회귀 0.

## CONTEXT.md 갱신
- "결근 차감 정책"(결근=정규 전액 차감 390) / "휴가 차감 정책"(무급, 차감 아님) 행 추가.
- "실근무 인정" 행 추가(workMinutes는 실제 clock 기준, 조기출근분 정규 인정, 연장은 정시 퇴근 15:00 초과분만).

## DoD 결과
- `pnpm test`: **75 passed** (14 files), baseline 74 + 신규 1.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm build`: Compiled successfully.
- `pnpm lint`: exit 0.

## 경계면 일치
- store(updateStatus) ↔ pay(calcPaidMinutes/calcDailyPay): 결근 deduct=390 → paid `max(0,0−390)=0` → 0원. 일관.
- seed(workMinutes 392) ↔ API `/api/pay/[date]`: paidMinutes 392 → amount 67424. 일관(route.test 갱신으로 계약 일치 확인).
