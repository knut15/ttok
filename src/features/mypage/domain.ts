// 프로필 형식 검증 + 편집 허용 필드 (순수, isomorphic). architect §3.2.
// FE(인라인 편집 가드)와 API(PATCH 400 검증)가 단일 출처로 공유.

/** 편집 허용 필드 화이트리스트(읽기전용 필드 강제). */
export const EDITABLE_FIELDS = ["phone", "email"] as const;

/** 이메일 형식. 공백 없는 local@domain.tld. O(len) ~ 실질 O(1). 빈 문자열 false. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** 휴대폰 형식. 010-{3~4}-{4}. 시드 010-3126-7299 통과. 빈 문자열 false. */
export function isValidPhone(value: string): boolean {
  return /^010-\d{3,4}-\d{4}$/.test(value);
}
