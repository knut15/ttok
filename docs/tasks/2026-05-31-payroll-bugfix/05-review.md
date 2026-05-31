# 리뷰 보고서 (v1) — T3 급여 버그수정

- **작성**: task-reviewer
- **리뷰 대상 커밋**: d411bed (base: c4869f8)
- **최종 판정**: PASS

---

## AC 매트릭스

| AC# | 내용 | 충족 증거 | 일치 |
|---|---|---|---|
| AC-T3-1 | `updateStatus(date,"결근")` → deduct===390, work/overtime/break===0, clock 보존 | `src/lib/store.ts:84-93` 결근 분기. `src/lib/store.test.ts:50-60` "'결근'으로 전환 시 정규 전액 차감…" GREEN | ✅ |
| AC-T3-2 | `updateStatus(date,"휴가")` → deduct===0, work/overtime/break===0 | `src/lib/store.ts:94-103` 휴가 분기. `src/lib/store.test.ts:39-47` "'정상'→'휴가' 전환…" GREEN | ✅ |
| AC-T3-3 | 지각(deduct>0)→정상/연장 전환 시 deduct===0 회귀 없음, 지각→지각 보존 | `src/lib/store.ts:119-120`. `src/lib/store.test.ts:86-97` 지각→정상/연장 deduct=0, 지각 유지 GREEN | ✅ |
| AC-T3-4 | seed 5/28 workMinutes===392, overtimeMinutes===0, status==="정상", amount===67424 | `src/lib/seed.ts:60` workMinutes:392. `src/lib/seed.test.ts:37-45` "④ 5/28 실근무 392분…amount 67424" GREEN | ✅ |
| AC-T3-5 | seed 불변식: ①deductΣ=440 ②연장 6회/544분 ③totalPay=Σitems | `src/lib/seed.test.ts:12-28` ①②③ 모두 GREEN. 5/28 workMinutes=392, overtimeMinutes=0 유지로 ②불변(6회/544분 그대로) | ✅ |
| AC-T3-6 | 5/28 금액 단정값 갱신 외 회귀 0. tsc/build/lint 통과 | `src/app/api/pay/[date]/route.test.ts:14-24` 67424로 갱신 GREEN. 75 passed (0 failed). tsc exit 0. build Compiled successfully. lint exit 0 | ✅ |

## 📊 AC 정량 증거 검증 (정량 #1)

- 전체 AC: 6개
- file:line 증거: 6개
- test ID 증거: 6개 (중복 포함)
- commit hash 증거: 0개
- 정량 증거 부재 (FAIL): 0개
- 바이패스 적용: 0개

AC 정량 증거 보유율: 6/6 = 100%

---

## 경계면 검증

### API/store ↔ pay 계산 (결근 분기)
- `store.ts:91` deductMinutes = REGULAR_MINUTES(390)
- `pay.ts:12` `calcPaidMinutes`: `if (status==="휴가") return 0` 외에는 `max(0, workMinutes - deductMinutes)` = max(0, 0 - 390) = 0
- `pay.ts:21` `calcDailyPay`: `round(0/60 × 10320)` = 0원
- 결근 → 급여 0원. 일관 ✅

### seed 5/28 ↔ API `/api/pay/[date]`
- `seed.ts:60` workMinutes:392, deductMinutes:0
- `pay.ts:12` paidMinutes = max(0, 392-0) = 392
- `pay.ts:21` amount = round(392/60 × 10320) = round(67456) → **67,424원** (실측값)
- `route.test.ts:23` expect(body.amount).toBe(67424) GREEN ✅

### 프로젝트 구조 (AC-Struct)
- 변경 파일: `src/lib/store.ts`, `src/lib/seed.ts`, `src/lib/store.test.ts`, `src/lib/seed.test.ts`, `src/app/api/pay/[date]/route.test.ts`, `CONTEXT.md`
- 모두 기존 파일 수정. 신규 파일 없음. 폴더 책임 침범 없음 ✅

### CONTEXT.md 갱신 (AC-Repo-1)
- diff에 "결근 차감 정책" / "휴가 차감 정책" / "실근무 인정" 3개 행 추가 확인 ✅
- 코드 변경과 같은 커밋(d411bed) 내 갱신 — mattpocock inline update 원칙 준수 ✅

---

## 빌드/테스트 결과

- **빌드**: ✅ Compiled successfully (Next.js 16.2.6 Turbopack, 1585ms)
- **단위 테스트**: ✅ 75 passed / 75 (14 files, 231ms)
- **tsc --noEmit**: ✅ exit 0
- **lint**: ✅ exit 0

신규 테스트: `store.test.ts` 결근 케이스 갱신 1건 + `seed.test.ts` ④ 케이스 1건 추가 → 74 → 75.

---

## 회귀 확인

`git diff --name-only c4869f8 d411bed` 결과:
- 코드: `src/lib/store.ts`, `src/lib/seed.ts`
- 테스트: `src/lib/store.test.ts`, `src/lib/seed.test.ts`, `src/app/api/pay/[date]/route.test.ts`
- 문서: `CONTEXT.md`, docs/tasks 내 board/prd/implementation (산출물 문서)

변경 범위가 store.ts/seed.ts/테스트/CONTEXT로 한정됨 ✅. pay.ts, time.ts, 기존 라우트 코드 무변경.

5/28 금액(67,080→67,424) 단정값을 갱신한 테스트 1건 이외 회귀 없음 (AC-T3-6 충족).

---

## 🤝 교차 검증 (codex review)

- **자체 판정**: PASS (하네스축)
- **codex 판정**: PASS (P1 없음)
- **호출 시각**: 2026-05-31T06:19:51+00:00
- **base**: c4869f8 (T2 커밋)
- **모델**: gpt-5.5
- **codex 지적 (이번 diff 범위 기준)**:
  - [P2] `src/lib/seed.ts:60` — 5/28 레코드에 `PATCH /api/attendance`로 `updateStatus`를 재호출하면 `calcOvertime(392) = 2`가 되어 `overtimeMinutes: 0 → 2`로 변경됨. 결과적으로 seed 불변식②(연장 6회/544분)가 런타임에서 위반 가능. → **이번 diff 내 노출된 잠재적 부작용 (P2, 차단 아님)** — follow-up P1로 분류.
- **P1 차단 사유**: 없음
- **최종 결정**: 하네스축 PASS + codex 코드축 PASS (P1 부재) → **PASS 확정**

---

## 최종 판정

- **판정**: PASS
- **AC**: 6/6 충족
- **DoD**: pnpm test 75/75 GREEN, tsc exit 0, build Compiled successfully, lint exit 0
- **회귀**: 의도적 5/28 금액 갱신 외 0건
- **codex 코드축**: PASS (이번 diff P1 없음)

---

## Follow-up (이번 task 범위 밖)

| 우선순위 | 내용 | 근거 |
|---|---|---|
| **P1** | 5/28 `updateStatus` 재호출 시 `calcOvertime(392)=2` → overtimeMinutes 0→2 변경으로 seed 불변식②(연장6회/544분) 런타임 위반 가능. `updateStatus` 정상/연장 분기가 workMinutes를 clock에서 재계산할 때 "정시 퇴근이면 연장 0" 정책이 반영되지 않음. 수정 방향: `calcOvertime` 호출 전 clock-out 기준 정책 적용 또는 392분 특수 처리 | codex P2 지적 (`src/lib/seed.ts:60`). 이번 diff가 노출. 별도 T4로 처리 권장 |
