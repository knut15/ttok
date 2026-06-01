import { describe, it, expect, afterEach } from "vitest";
import {
  isValidBizChecksum,
  normalizeBizNumber,
  validateBizNumber,
} from "./biz-number";

describe("normalizeBizNumber", () => {
  it("하이픈/공백을 제거하고 숫자만 남긴다", () => {
    expect(normalizeBizNumber("220-81-62517")).toBe("2208162517");
    expect(normalizeBizNumber(" 220 81 62517 ")).toBe("2208162517");
  });
});

describe("isValidBizChecksum", () => {
  it("유효한 사업자번호(220-81-62517)는 true", () => {
    expect(isValidBizChecksum("220-81-62517")).toBe(true);
    expect(isValidBizChecksum("2208162517")).toBe(true);
  });

  it("체크섬이 틀리면 false", () => {
    expect(isValidBizChecksum("220-81-62518")).toBe(false);
    expect(isValidBizChecksum("1234567890")).toBe(false);
  });

  it("자릿수가 10이 아니면 false", () => {
    expect(isValidBizChecksum("220816251")).toBe(false);
    expect(isValidBizChecksum("22081625170")).toBe(false);
    expect(isValidBizChecksum("")).toBe(false);
  });
});

describe("validateBizNumber (env 분기)", () => {
  const prev = process.env.BIZ_VALIDATION;
  afterEach(() => {
    if (prev === undefined) delete process.env.BIZ_VALIDATION;
    else process.env.BIZ_VALIDATION = prev;
  });

  it("기본/off: 아무 번호나 통과(loc·dev)", async () => {
    delete process.env.BIZ_VALIDATION;
    expect(await validateBizNumber("아무거나")).toBe(true);
    process.env.BIZ_VALIDATION = "off";
    expect(await validateBizNumber("0000000000")).toBe(true);
  });

  it("checksum: 체크섬 통과분만 true", async () => {
    process.env.BIZ_VALIDATION = "checksum";
    expect(await validateBizNumber("220-81-62517")).toBe(true);
    expect(await validateBizNumber("220-81-62518")).toBe(false);
  });

  it("nts: 체크섬 실패는 즉시 false(진위확인 미도달)", async () => {
    process.env.BIZ_VALIDATION = "nts";
    expect(await validateBizNumber("220-81-62518")).toBe(false);
    // 체크섬 통과분은 stub 가 true (실 NTS 연동은 후속)
    expect(await validateBizNumber("220-81-62517")).toBe(true);
  });
});
