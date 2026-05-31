# 구현 노트 (T6) — TODAY 하드코딩 버그수정

## AC 충족 매핑

| AC | 충족 위치 | 요약 |
|---|---|---|
| AC-T6-1 | `src/lib/date.ts:62-71` `todayDate(now=new Date())` | 로컬 기준 `YYYY-MM-DD`. `getFullYear`/`getMonth()+1`/`getDate()` zero-pad. UTC 변환 없음. 테스트 3종 GREEN. |
| AC-T6-2 | `src/app/page.tsx` | `const TODAY="2026-05-29"` 및 import 제거. `grep "2026-05-29" src/app/page.tsx` = 0. |
| AC-T6-3 | `src/features/attendance/components/HomeToday.tsx` | 날짜 헤더(formatDotDate)와 `<ClockToggle date>` 둘 다 동일 `today` 변수 사용. |
| AC-T6-4 | `HomeToday.tsx` `useSyncExternalStore` | 서버/첫 CSR 스냅샷 모두 `false` → placeholder HTML 일치(하이드레이션 경고 없음). 하이드레이션 후 `true` → today 계산. |
| AC-T6-5 | 전체 | 116→119 테스트 GREEN(신규 3). tsc/build/lint 0. `date.ts` append-only(기존 export 불변). 홈 외 무변경. |

## 수정 요약 (파일:라인)

1. `src/lib/date.ts:62-71` — `todayDate()` 순수 헬퍼 append.
2. `src/app/page.tsx:2-7` — 하드코딩 상수·`ClockToggle`/`formatDotDate`/`Link` import 정리, `HomeToday` import 추가. 날짜헤더+토글을 `<HomeToday />` 한 줄로 교체. RSC 셸 유지.
3. `src/features/attendance/components/HomeToday.tsx` (신규, 'use client') — 마운트 게이트 후 `todayDate()` 계산, 날짜 Link + ClockToggle 렌더. 마운트 전 스켈레톤 placeholder.

## 추가 테스트 (`src/lib/date.test.ts`)

- `todayDate(new Date(2026,4,31)) === "2026-05-31"` (month 0-index 4=5월)
- `todayDate(new Date(2026,0,1)) === "2026-01-01"`
- `todayDate(new Date(2026,11,9)) === "2026-12-09"` (zero-pad)

UI/하이드레이션은 vitest node 환경상 렌더테스트 미지원 → 빌드/타입/lint + 코드 리뷰(클라 마운트 후 계산, placeholder 존재)로 검증.

## 하이드레이션 처리 방식

`useState(null)+useEffect(setState)` 대신 `useSyncExternalStore(emptySubscribe, ()=>true, ()=>false)` 채택.
- 서버 스냅샷(`getServerSnapshot`)과 첫 클라 렌더가 모두 `false` → SSR/CSR HTML 동일(placeholder) → 하이드레이션 불일치 0.
- 하이드레이션 완료 후 client snapshot `true`로 re-render → `todayDate()` 로컬 계산.
- `react-hooks/set-state-in-effect` lint 규칙도 회피(effect 내 동기 setState 없음).
- 홈 `/`는 빌드상 정적(○) 유지, 빌드 경고 0.

## TDD 사이클

| 사이클 | AC | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 1 | AC-T6-1 | `todayDate is not a function` 확인 | `date.ts` 구현 → 22 passed | 중복 없음(skip) |

UI(AC-T6-2~4)는 렌더테스트 미지원 영역 → 빌드/타입/lint 게이트로 검증.

## DoD 수치

- `pnpm test`: 119 passed (116 기존 + 3 신규), 회귀 0
- `pnpm exec tsc --noEmit`: 0 error
- `pnpm build`: 성공, `/` 정적(○) 프리렌더, 하이드레이션 경고 없음
- `pnpm lint`: 0 error
