---
slug: project-code-verify
status: done
created: 2026-06-04
---

# 프로젝트 코드 검증

## 🎯 목표
미푸시 5건(디자인·마스터 변경) 배포 전, 코드 건전성을 검증한다.
dev(Turbopack) 통과 ≠ 프로덕션 빌드 통과 → **프로덕션 빌드까지** 확인이 핵심.

## 📋 단계
- [x] **plan** — 검증 항목·접근·리스크
- [x] **do** — 검증 실행
- [x] **verify** — 결과 판정(이슈 시 수정)
- [x] **done** — 마무리

## 🔍 검증 항목 (plan)
1. **타입체크** — `npx tsc --noEmit` (0 에러)
2. **린트** — `pnpm lint` (eslint, 미사용 import·경고)
3. **테스트** — `pnpm test` (vitest, 342 기준 회귀 0)
4. **프로덕션 빌드** — `npx next build` (next/font/local·RSC·useSearchParams 등 빌드타임 이슈)

**리스크/주목점**
- 프로덕션 빌드는 dev가 못 잡는 것을 잡음(가장 가치): Pretendard `next/font/local`, 서버 `searchParams` 사용, 미사용 import.
- `pnpm build`는 앞에 `prisma migrate deploy`가 붙어 로컬 DB를 건드림 → 빌드 검증은 `npx next build`로 격리(마이그레이션 제외).
- eslint가 이번 대량 변경(전역 치환)에서 미사용 import/변수를 잡을 수 있음.

## 🗒 진행 로그
- 2026-06-04 plan 시작
- 2026-06-04 plan 완료: 4항목(tsc/lint/test/build) 정의, 빌드 격리(next build) 결정
- 2026-06-04 do/verify 완료: 전 항목 PASS
  - tsc --noEmit: 0 에러
  - eslint: 0 경고/에러
  - vitest: 342/342 통과 (회귀 0)
  - next build: 성공, 35개 라우트 컴파일, 정적 30/30 생성, 빌드타임 이슈 0
- 2026-06-04 done: 검증 통과 → 배포 가능. 미푸시 5건.
