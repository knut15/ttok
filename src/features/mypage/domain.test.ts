import { describe, it, expect } from "vitest";
import { isValidEmail, isValidPhone, EDITABLE_FIELDS } from "./domain";

describe("isValidEmail (AC-8)", () => {
  it("@ + 도메인 형식은 true", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("24joy@naver.com")).toBe(true);
  });
  it("@ 없거나 도메인 누락이면 false", () => {
    expect(isValidEmail("ab.com")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidPhone (AC-8)", () => {
  it("010-XXXX-XXXX 형식은 true (시드값 포함)", () => {
    expect(isValidPhone("010-3126-7299")).toBe(true);
    expect(isValidPhone("010-123-4567")).toBe(true);
  });
  it("문자/자릿수 불일치는 false", () => {
    expect(isValidPhone("abc")).toBe(false);
    expect(isValidPhone("010-12")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("EDITABLE_FIELDS", () => {
  it("phone/email만 편집 허용", () => {
    expect(EDITABLE_FIELDS).toEqual(["phone", "email"]);
  });
});
