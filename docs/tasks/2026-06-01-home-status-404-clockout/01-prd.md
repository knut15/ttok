# 스펙 (T12) — 홈 상태전용 + 404→200 + 퇴근 확인

- 작성: orchestrator (압축 파이프라인, 사용자 결정 반영) / teammate
- 유형: UI 변경 2 + API 계약 1

## 배경/결정
T11에서 출퇴근 등록 FAB를 `/attendance`에 추가함. 이제 사용자 3건:
- **B 홈 버튼 제거**: 홈은 출퇴근 **상태만 표시**, 출근/퇴근 버튼 제거(등록은 FAB로 일원화).
- **C 404→200**: `GET /api/attendance/[date]`가 유효 날짜·기록 없음일 때 404 대신 **200 + null/빈 상태**.
- **D 퇴근 확인**: 퇴근 등록 시 **현재 시각을 확인 대화상자**로 보여주고 확인 후 처리. (출근은 즉시 — 사용자 결정.)

## AC
- **AC-1 (B)**: 홈(`HomeToday`/`ClockToggle`)에서 출근/퇴근/마감 **버튼 제거**. 상태 표시(매장명·"N시간 근무했어요!"/근무중/오늘도 화이팅·진행바)는 유지. 홈에서 클록 PATCH 호출 경로 없음(등록은 FAB만).
- **AC-2 (C)**: `GET /api/attendance/[date]`가 **유효한 날짜 형식**인데 기록 없음 → **200 + body `null`**(또는 빈상태). 잘못된 날짜 형식은 기존대로(400/404 — 현재 동작 확인 후 유지). 클라(useTodayClock/useDayAttendance/ClockToggle/ClockFab)는 200 null을 record 없음으로 처리(기존 `res.ok?json:null` → json이 null이어도 OK). 관련 테스트 404→200+null 의도적 갱신.
- **AC-3 (D)**: FAB(또는 퇴근 진입점) **퇴근(clockOut)** 클릭 시 `window.confirm`(또는 동등 확인 UI)으로 "현재 시각 HH:MM에 퇴근 처리할까요?" 표시 → 확인 시에만 clockOut PATCH, 취소 시 미처리. **출근(clockIn)은 즉시**(확인 없음).
- **AC-4 회귀**: 기존 195 테스트 회귀 0(C 관련 의도적 갱신 제외). tsc/build/lint 0. 날짜클릭 상세·크루격리·마스터게이트·FAB 등록(출근 즉시)·cursor 불변. 크루 스코프 유지.

## 변경 대상
- **B**: `src/features/attendance/components/ClockToggle.tsx`(또는 HomeToday) — 홈용 상태전용. ClockToggle이 홈/기타 공용이면 홈에서는 버튼 숨김(prop `readOnly`/`statusOnly`) 또는 HomeToday가 상태-only 컴포넌트 사용. FAB(ClockFab)·attendance는 영향 없게.
  - 주의: ClockToggle이 홈에서만 쓰이면 직접 버튼 제거. 다른 곳에서도 쓰면 prop으로 분기.
- **C**: `src/app/api/attendance/[date]/route.ts` — 기록 없음 시 200 + null. (잘못된 날짜 형식 검증은 유지.) `src/app/attendance/[date]/page.tsx`·`AttendanceDetail`이 null을 "기록 없음"으로 처리하는지 확인(이미 그럴 것). 관련 route 테스트 갱신.
- **D**: `src/features/attendance/components/ClockFab.tsx`(+필요시 useTodayClock) — clockOut 경로에 confirm. nowHHMM()으로 메시지. 출근 경로 불변.

## DoD
```
pnpm test   # 195 + 신규/갱신, 회귀 0(C 갱신 제외)
pnpm exec tsc --noEmit
pnpm build
pnpm lint
```

## 주의(회귀 함정)
- C: 404→200 변경 시 **기존 404 단정 테스트**(AC-7 계열)를 200+null로 의도적 갱신. 잘못된 날짜(`2026-05-99` 등) 처리 경로는 유지(런타임 크래시 금지).
- B: ClockToggle 사용처 grep — 홈 외 사용 없으면 직접 제거, 있으면 prop 분기(FAB/attendance 회귀 0).
- D: confirm은 client 전용(window.confirm). SSR 영향 없음. 출근 즉시 유지(T11 회귀 0).
