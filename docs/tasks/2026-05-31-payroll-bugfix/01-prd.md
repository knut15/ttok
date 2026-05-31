# 스펙 (T3) — 급여 버그수정

- **작성**: orchestrator (사용자 의미 결정 반영)
- **유형**: 버그수정 (압축 파이프라인)
- **근거**: T2 codex 교차검증이 T1 코드에서 발견 (P1 store.ts, P2 seed.ts)

## 배경 / 근본 원인
1. **P1** `src/lib/store.ts` `updateStatus`: 휴가·결근 분기가 둘 다 `deductMinutes=0`으로 처리. 결근은 본래 급여차감이 발생해야 하나(시드 5/22는 결근을 deduct로 모델링) 상태변경으로 결근 적용 시 차감이 사라져 **급여차감시간 합산이 과소·급여 과다지급** 위험.
2. **P2** `src/lib/seed.ts` 5/28 레코드: clockIn 07:58 / clockOut 15:00 → 실근무 = 422−30(휴게) = **392분**인데 `workMinutes: 390`으로 하드코딩 → clock과 workMinutes 불일치.

## 사용자 결정 (의미 확정)
- **P1**: **결근 = 정규 전액 차감.** 결근 전환 시 `deductMinutes = REGULAR_MINUTES(390)`, `workMinutes=0`, `overtimeMinutes=0`, `breakMinutes=0` (clockIn/clockOut 보존). 휴가는 `deductMinutes=0`, work/overtime/break=0 (단순 0원, 차감 아님). → 결근/휴가 의미 구분.
- **P2**: **실근무 그대로 인정.** 출근시각은 실제 입력값이므로 07:58 유지. 5/28 `workMinutes: 390 → 392`. 정시 퇴근(15:00)이라 연장 아님 → `overtimeMinutes: 0` 유지, `status: 정상` 유지. 일급 = round(392/60 × 10,320) = **67,424원**.

## AC (검증 가능)
- **AC-T3-1**: `updateStatus(date, "결근")` 반환 레코드가 `deductMinutes === 390`(REGULAR_MINUTES), `workMinutes===0`, `overtimeMinutes===0`, `breakMinutes===0`, `clockIn/clockOut`은 기존 값 보존.
- **AC-T3-2**: `updateStatus(date, "휴가")` 반환 레코드가 `deductMinutes===0`, `workMinutes===0`, `overtimeMinutes===0`, `breakMinutes===0`.
- **AC-T3-3**: `updateStatus`로 지각(deduct>0)→정상/연장 전환 시 `deductMinutes===0`(기존 v3 동작 회귀 없음), 지각→지각 유지 시 보존.
- **AC-T3-4**: seed 5/28 레코드 `workMinutes===392`, `overtimeMinutes===0`, `status==="정상"`. 해당일 pay item `amount === 67424`.
- **AC-T3-5**: seed 불변식 유지/정정 — ① 급여차감 Σ===440(시드 정적값 불변) ② 연장 6회·Σ===544(5/28 연장 0 유지) ③ `summary.totalPay === Σ items.amount`(5/28 반영 후에도 일관). 기존 seed.test 불변식 ①②는 그대로 통과, ③은 totalPay가 5/28 +344 반영되어도 일관성 유지.
- **AC-T3-6**: 회귀 — 기존 74 테스트 중 **5/28 금액(67,080→67,424)을 단정하던 테스트만 의도적 갱신**, 그 외 회귀 0. `tsc --noEmit`/`build`/`lint` 통과.

## 변경 대상 (최소)
- `src/lib/store.ts` `updateStatus` 결근 분기 분리(휴가와 다르게 deduct=390).
- `src/lib/seed.ts` 5/28 workMinutes 390→392.
- 관련 테스트: `store.profile.test.ts`/`store.test.ts`(결근 케이스 추가), `seed.test.ts` 또는 pay 테스트(5/28 amount 갱신), 신규 결근/휴가 단위테스트.
- `CONTEXT.md`: 결근 차감 정책 + "실근무 인정(조기출근분도 정규 인정, 연장은 정시 퇴근 초과분만)" 명문화.

## DoD
```bash
pnpm test       # 갱신 후 전부 GREEN (의도적 5/28 금액 변경 외 회귀 0)
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```

## 주의 (회귀 함정)
- `updateStatus` 결근 분기를 휴가와 분리할 때, 기존 "휴가/결근 둘 다 break=0" 동작에 의존하던 테스트가 있으면 결근 케이스만 갱신.
- 5/28 workMinutes=392로 인해 `calcOvertime(392)`가 2를 줄 수 있으나, **seed는 explicit overtimeMinutes 필드(0)를 사용**하므로 mutation 경로(calcOvertime)와 분리됨. seed 5/28 overtimeMinutes는 0으로 명시 유지.
- buildPayItems가 5/28 amount를 workMinutes(392) 기준으로 산출하는지 확인(정규 390으로 캡하지 말 것 — 실근무 인정).
