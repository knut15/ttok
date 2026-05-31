# 스펙 (T6) — TODAY 실제 날짜 버그수정

- **작성**: orchestrator / **유형**: 버그수정 (압축 파이프라인) / teammate
- **근거**: 사용자 보고 — "오늘은 5/31인데 앱이 29로 표기. 5/30·31 근무기록 불가."

## 근본 원인
`src/app/page.tsx:9` `const TODAY = "2026-05-29";` **하드코딩**. 홈 날짜 헤더(`formatDotDate(TODAY)`)와 `ClockToggle date={TODAY}`가 항상 5/29를 "오늘"로 사용 → 실제 오늘(5/31)에 출퇴근 토글 불가.
- ⚠️ `js month 오류 아님`: `src/lib/date.ts`의 `getMonth()+1` 등은 정상. 순수 하드코딩 상수 문제.

## 결정 (사용자 의도)
TODAY = **실제 현재 날짜**(사용자 로컬 기준 YYYY-MM-DD). 하드코딩 제거.
- 홈 날짜 헤더가 실제 오늘 표기, `ClockToggle`이 실제 오늘 날짜에 기록(없으면 upsert 신규 생성 — 기존 `upsertTodayClock`이 처리).
- 데모 시드(2026-05)와 정합: 실제 오늘 2026-05-31은 시드 월(2026-05) 내 → 캘린더/급여 기본월(SEED_MONTH=2026-05) 그대로 두어도 일관. (캘린더/급여 기본월은 본 범위 밖, 변경 없음.)

## 기술 제약 (함정)
- 홈 `/`는 **정적 프리렌더**(build 시 `new Date()` 고정됨) → 서버에서 today 계산 금지.
- **하이드레이션 불일치 회피**: 클라이언트 마운트 후 today 계산(`useState(null)` + `useEffect`로 set, 마운트 전 placeholder). 또는 동등한 client-only 계산.
- 타임존: 사용자 로컬 날짜(`new Date()`의 로컬 getFullYear/getMonth/getDate). UTC 변환 금지(날짜 밀림 방지).

## AC
- **AC-T6-1**: `todayDate(now?: Date): string` 순수 헬퍼를 `src/lib/date.ts`에 추가 — 로컬 기준 `YYYY-MM-DD` 반환. 테스트: `todayDate(new Date(2026,4,31))==="2026-05-31"`(month 0-index 5월=4 검증), `todayDate(new Date(2026,0,1))==="2026-01-01"`.
- **AC-T6-2**: 홈(`/`)이 더 이상 `"2026-05-29"` 하드코딩을 쓰지 않고 실제 현재 날짜를 표기·토글 대상으로 사용. `grep "2026-05-29" src/app/page.tsx` 결과 0.
- **AC-T6-3**: 홈 날짜 헤더와 `ClockToggle`이 동일한 "오늘" 값을 사용(불일치 없음).
- **AC-T6-4**: 하이드레이션 경고 없음(클라 마운트 후 계산, SSR/CSR 텍스트 불일치 없음). 마운트 전 적절한 placeholder.
- **AC-T6-5**: 회귀 0 — 기존 116 테스트 GREEN + `tsc`/`build`/`lint` 0 + 7라우트·4탭 정상. `formatDotDate` 등 기존 함수 불변(append-only).

## 변경 대상 (최소)
- `src/lib/date.ts`: `todayDate(now=new Date())` append (+테스트 `date.test.ts`).
- `src/app/page.tsx`: 하드코딩 TODAY 제거. 날짜헤더+ClockToggle을 client 컴포넌트로 분리(예 `src/features/attendance/components/HomeToday.tsx` 신규, 'use client', useState/useEffect로 today)하거나 동등 처리. RSC page는 셸 유지.

## DoD
```bash
pnpm test          # 116 + 신규, 회귀 0
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```

## 주의
- `todayDate`는 `now` 파라미터 주입 가능하게 하여 결정적 테스트(고정 Date). 내부 `new Date()` 기본값.
- month 0-index 함정: `new Date(2026,4,31)`은 5월 31일(4=May). `todayDate`가 `getMonth()+1`로 1-index 변환 정확히.

---

## 📌 REWORK C — 범위 확장 (사용자 결정 2026-05-31): 앱 전체 실제월 추종

> codex P1(홈=실제오늘인데 캘린더/급여 기본월=SEED_MONTH 고정 → 6월부터 단절) 해소. 사용자가 "앱 전체 실제월 추종" 선택.

- **AC-T6-6**: `todayMonth(now?: Date): string` 순수 헬퍼(`src/lib/date.ts`, 로컬 `YYYY-MM`) 추가 + 테스트(`todayMonth(new Date(2026,4,31))==="2026-05"`, `new Date(2026,11,1)==="2026-12"`). 또는 `todayDate().slice(0,7)` 재사용해도 무방하나 헬퍼 권장.
- **AC-T6-7**: 캘린더(`AttendanceCalendarView`) 기본 월이 `SEED_MONTH` 고정이 아니라 **실제 현재월**로 초기화. 하이드레이션 안전(SSR/CSR 불일치 0 — T6의 mount-gate 패턴 재사용 또는 동등). ‹›화살표·picker 이동은 기존대로.
- **AC-T6-8**: 급여(`/pay`)도 기본 월이 **실제 현재월**. `/pay/page.tsx`가 RSC면 client 래퍼로 분리(예 `PayView`)하여 현재월 계산. PaySummaryCard/PayList는 month prop 그대로 재사용(시그니처 불변).
- **AC-T6-9**: 월 picker 범위(T5 Q1 입사월~현재월)의 "현재월"도 실제 현재월 기준으로 일관. 입사월(2026-04)~실제현재월.
- **AC-T6-10**: 회귀 0 — 기존 119 테스트 GREEN + 신규 + tsc/build/lint 0. 5월(현재) 기준 캘린더/급여가 5월(시드) 표시 → 기존 화면 동일. 6월엔 빈 6월 기본(graceful) + 5월은 이동해서 조회.

### 주의
- 6월 이후 기본 뷰가 비는 것은 **의도된 동작**(시드는 과거 데이터, 실데이터는 토글로 생성). 빈 달 graceful 이미 처리됨.
- 캘린더/급여 기본월 client 계산 시 하이드레이션 불일치 주의(T6 home과 동일 패턴).
