# 스펙 (T13) — 홈 진행바 실제 출퇴근시각 표기
- orchestrator / 압축 파이프라인 / teammate
## 배경/결정
홈 ClockToggle 진행바 하단 좌측 라벨이 `REGULAR_RANGE`("08:00~15:00") 하드코딩. 실제 출근/퇴근 시각으로.
## AC
- AC-1: 근무중(phase working)일 때 진행바 좌측 라벨이 **실제 출근시각(record.clockIn)** 표기. 퇴근시각은 아직 미노출(예 "14:30 ~" 또는 "출근 14:30").
- AC-2: 마감(phase done)일 때 **출근~퇴근(clockIn ~ clockOut)** 표기(예 "14:30 ~ 15:30").
- AC-3: 미출근(before, record 없음/clockIn 없음)일 때는 정규시간 placeholder("08:00~15:00") 또는 "—" 유지(택: 정규 placeholder 유지가 무난). REGULAR_RANGE 하드코딩 라벨을 record 기반 동적 라벨 함수로 대체.
- AC-4: 회귀 0(기존 199 테스트, FAB/퇴근confirm/홈 상태표시 불변). 라벨 포맷 순수함수로 테스트.
## 변경
- `src/features/attendance/components/ClockToggle.tsx`: leftLabel을 record/phase 기반 동적 라벨로. 라벨 산출은 순수함수(예 `src/features/attendance/domain.ts`에 `clockRangeLabel(record, phase)` append)로 추출해 테스트.
- before: REGULAR_RANGE("08:00 - 15:00") 유지(정규 안내). working: `${clockIn} ~`(퇴근 미정). done: `${clockIn} ~ ${clockOut}`.
## DoD
pnpm test(199+) / tsc / build / lint 전부 GREEN. 회귀 0.
