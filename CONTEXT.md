# CONTEXT — Crewmon 출퇴근·급여 앱 도메인 용어집

> 이 문서는 프로젝트의 도메인 캐논(canonical) 정의다. 코드/PRD/리뷰가 같은 의미로 용어를 쓰도록 단일 출처 역할을 한다.
> 참조 디자인: `public/sample/IMG_3606~3619.png` (Crewmon 앱). 범위: 홈 / 출퇴근 / 급여 / 마이페이지 / 프로필.

## 핵심 용어

| 용어 | 정의 |
|---|---|
| **근무시간** (workMinutes) | 퇴근시각 − 출근시각 − 휴게시간. 분(minute) 단위. 시각 역전·음수는 0으로 하한 처리. |
| **휴게시간** (breakMinutes) | 근무 중 무급 휴게(예 11:30~12:00 = 30분). 근무시간에서 차감. |
| **급여인정시간** (paidMinutes) | 근무시간에서 급여차감시간을 뺀, 급여 산정 기준 시간. `max(0, workMinutes − deductMinutes)`. 휴가일은 0. |
| **급여차감시간** (deductMinutes) | 지각·결근 등으로 근무로 인정되지 않아 급여인정시간에서 제외되는 시간(분). |
| **결근 차감 정책** | 결근 = 정규 전액 차감. `updateStatus(date,"결근")` 시 `deductMinutes = REGULAR_MINUTES(390)`, `workMinutes/overtimeMinutes/breakMinutes = 0`(clockIn/clockOut 보존) → 급여인정시간 0원. 결근과 휴가는 의미가 다르다(차감 vs 단순 0원). |
| **휴가 차감 정책** | 휴가 = 무급(차감 아님). `deductMinutes = 0`, work/overtime/break = 0. 일급 0원이되 급여차감시간 합산에 포함되지 않는다. |
| **실근무 인정** | `workMinutes`는 실제 clock(출/퇴근 시각) 기준으로 산정한다. 조기 출근분도 정규 인정시간에 포함되며(예 5/28 07:58 출근 → 392분), 연장(overtimeMinutes)은 **정시 퇴근(정규 종료시각 15:00=900분) 초과분만** 인정한다. 정시에 퇴근하면 조기출근으로 근무가 392분이어도 연장은 0이다. |
| **연장근무** (overtimeMinutes) | 정시 퇴근(정규 종료시각 15:00=900분) 초과분. 급여·캘린더에서 별도 집계·표기. **`max(0, parseHHMM(clockOut) − 900)`, clockIn·workMinutes 무관**(ADR 0001). `src/lib/time.ts` `calcOvertimeByClock`. 조기출근으로 workMinutes가 390을 넘어도 정시 퇴근이면 연장 0. (이전 `workMinutes − 390` 표현은 조기출근 시 연장 오산정 → ADR 0001로 교정.) |
| **정규 근무시간** | 기준선 08:00~15:00, 휴게 30분 → 390분(6시간30분). `src/lib/constants.ts`. |
| **일급** (dailyPay/amount) | `round(급여인정시간/60 × 시급)`. 휴가일은 0원. 검산: 390분 × 10,320원 = 67,080원. |
| **주휴수당** (weeklyHolidayPay) | 주 소정근로 충족 시 지급되는 별도 급여 항목. 급여 리스트에서 **블루 별도 행**. 본 구현은 시드 고정값(67,080원 1건)으로 처리(산식 비구현). |
| **출근상태** (WorkStatus) | `정상 / 지각 / 결근 / 휴가 / 연장` 5종 enum. |
| **근무기록 수정요청** (EditRequest) | 출퇴근/상태 정정 요청. 사유(0~100자) 입력 후 생성. 상태 `대기 → 수락` 추적. **수락 시 해당 날짜 레코드에 `after`(status·clockIn·clockOut)를 반영하고 work/overtime(연장 정합)·차감 정책을 재계산**한다(`approveRequest`, `POST /api/attendance/requests/approve`). 레코드 없는 날은 after 로 신규 생성(upsert), 이미 수락된 요청 재수락은 멱등 no-op(레코드 불변). 응답은 `{request, record}`(ApproveResult). 거절/철회/수락취소는 미지원. |
| **월 급여 요약** (PaySummary) | `{ totalPay, deductMinutes, overtimeCount, overtimeMinutes }`. 불변식: `totalPay = Σ items.amount`(주휴 포함). |
| **사용자 프로필** (UserProfile) | 근무자 개인정보 `{ name, birthDate, phone, email, avatarInitial }`. 이름·생년월일은 본인인증 전 **읽기전용**, 휴대폰·이메일만 편집 가능. |
| **매장 정보** (StoreInfo) | 소속 매장 `{ name, joinDate, employed, workDays, workTime }`. UI 표기 "입사 YYYY.MM.DD ~ 재직중 / 근무 월~금 HH:MM~HH:MM". |
| **읽기전용 필드 정책** | 이름·생년월일 변경은 본인인증(미구현)을 전제로 하며, `PATCH /api/profile`이 화이트리스트(phone/email)로 해당 필드를 무시(200)하여 계약 단일 출처(store)에서 강제한다. 형식 오류(이메일/전화)는 400. |

## 데이터 표기 규칙 (UI)

- 캘린더 배지: 그린 `+N분` = 정규 초과 연장분, `-N분` = 정규 대비 부족분. `+0분`은 숨김(노이즈 제거).
- 휴가일: 일급 0원, 캘린더 `휴가` 라벨.
- 메인 컬러: 코랄/오렌지 `#F26B4D` (1차 액션·강조).

## 시드 불변식 (자의적 구성 금지 — `src/lib/seed.test.ts`가 강제)

1. 급여차감시간 월 합계 = **440분**
2. 연장 **6회**, 연장 월 합계 = **544분**(9시간4분)
3. `totalPay = Σ items.amount` (주휴수당 67,080원 1건 포함)

이미지의 일별 배지 액면값이 위 summary 제약과 충돌하면 **summary 제약이 우선**한다(배지는 표기일 뿐).

## 운영 메모

- 백엔드: Next.js Route Handler + **인메모리 store**(외부 DB·인증 없음). 서버 재시작 시 시드로 초기화 — 명세된 동작이며 버그 아님.
- 데이터 페칭: 전 라우트 client fetch + `cache:'no-store'`(인메모리 진실원과 일치).
