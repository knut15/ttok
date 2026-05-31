# ADR 0002 — 프로필 읽기전용 필드(이름·생년월일) 서버 강제

Date: 2026-05-31
Status: Accepted

## Context

마이페이지 프로필 수정 화면에서 휴대폰·이메일은 편집 가능하나, 이름·생년월일은 본인인증(미구현)을 전제로 변경이 제한된다. 클라이언트에서 input을 `disabled` 처리하는 것만으로는 계약을 보장할 수 없다(개발자도구·직접 PATCH 호출로 우회 가능). 계약을 단일 출처(인메모리 store)에서 강제할 방법이 필요했다.

## Decision

`PATCH /api/profile`을 **화이트리스트 방식**으로 구현한다. 검증 우선순위는 형식(400) → 화이트리스트(name/birthDate 무시) → 머지(200)다.

1. 형식 검증: 전달된 `phone`/`email`이 형식 오류면 **400** + store 무변 (`features/mypage/domain.ts`의 `isValidPhone`/`isValidEmail`).
2. 화이트리스트 추출: `phone`/`email`만 추출. `name`/`birthDate`가 body에 섞여 와도 탈락(무시).
3. 머지: `store.updateProfile()`이 조건부 spread로 `phone`/`email`만 대입 — 미허용 키는 대입 자체가 일어나지 않음.

타입 레벨에서도 `ProfilePatch = Partial<Pick<UserProfile, "phone" | "email">>`로 좁혀 컴파일타임 방어선을 둔다(승인 §0 쟁점2 (b) 200+무시 정책). 클라이언트 `disabled` + 서버 화이트리스트의 이중 방어.

## Consequences

- 이름·생년월일은 어떤 경로(잘못된 클라이언트, 직접 API 호출)로도 변경되지 않는다 — 계약이 store에서 단일 강제됨.
- name/birthDate 포함 PATCH는 에러가 아니라 200(부분 PATCH 표준에 부합) — 클라이언트는 에러 처리가 불필요.
- 본인인증 기능이 추가되면 화이트리스트에 필드를 추가하는 방식으로 확장 가능(EDITABLE_FIELDS 상수가 단일 출처).
- 형식 검증 함수가 FE(인라인 편집 가드)와 API(400)에서 동일 모듈을 공유 → 검증 규칙 단일 출처.

## Alternatives Considered

- **400으로 거부**(승인 §0 쟁점2 (a)) → 채택 안 함. 클라이언트가 애초에 name/birthDate를 전송하지 않으므로 400 경로는 도달 빈도가 낮고, 부분 PATCH 의미론상 "조용히 무시"가 더 자연스러움.
- **클라이언트 disabled 단독 신뢰** → 채택 안 함. 서버 강제가 없으면 직접 호출로 우회 가능, 계약 보장 불가.
- **별도 globalThis 싱글톤 분리**(승인 §0 쟁점1 (B)) → 채택 안 함. `__resetStore()` 미동기화로 테스트 격리가 깨짐. StoreShape 확장(A)이 단일 싱글톤 일관성 우위.
