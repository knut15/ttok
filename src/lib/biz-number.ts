// 사업자등록번호 검증 — 순수 모듈(부수효과 없음, Next/Prisma 비의존).
// loc/dev 는 검증 생략(아무 번호 허용), prod 는 체크섬/국세청(NTS) 진위확인.
// 환경 분기는 BIZ_VALIDATION: "off"(기본·dev) | "checksum" | "nts".

/** 국세청 사업자등록번호 체크섬 가중치(앞 9자리). */
const WEIGHTS = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;

/** 하이픈/공백 제거 후 숫자만 반환. */
export function normalizeBizNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * 국세청 체크섬 알고리즘 검증(10자리). 형식만 검증 — 실재 사업자 여부는 NTS API.
 * 1) 앞 9자리 × WEIGHTS 합, 2) + floor(9번째자리 × 5 / 10),
 * 3) check = (10 - 합%10) % 10, 4) check === 10번째 자리면 유효.
 */
export function isValidBizChecksum(raw: string): boolean {
  const d = normalizeBizNumber(raw);
  if (d.length !== 10) return false;
  const n = [...d].map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += n[i] * WEIGHTS[i];
  sum += Math.floor((n[8] * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === n[9];
}

/**
 * 환경별 검증 진입점. dev("off") → 무조건 통과(테스트 번호 허용).
 * "checksum" → 체크섬만. "nts" → 체크섬 + 국세청 진위확인(prod, env NTS_SERVICE_KEY).
 */
export async function validateBizNumber(raw: string): Promise<boolean> {
  const mode = process.env.BIZ_VALIDATION ?? "off";
  if (mode === "off") return true; // loc/dev: 아무 번호 허용
  if (!isValidBizChecksum(raw)) return false;
  if (mode === "nts") return ntsVerify(normalizeBizNumber(raw));
  return true; // "checksum"
}

/**
 * 국세청 사업자등록 진위확인 API(prod TODO). NTS_SERVICE_KEY 로 호출.
 * 현재는 체크섬 통과분을 그대로 인정하는 stub — 실제 연동은 후속 스텝.
 */
async function ntsVerify(digits: string): Promise<boolean> {
  // TODO(prod): https://api.odcloud.kr/api 국세청 진위확인 호출(NTS_SERVICE_KEY) with `digits`.
  void digits;
  return true;
}
