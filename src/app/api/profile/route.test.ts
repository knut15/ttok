import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH } from "./route";
import { resetDb } from "@/lib/db-seed";

beforeEach(async () => {
  await resetDb();
});

function patchReq(body: unknown) {
  return new Request("http://localhost/api/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("GET /api/profile (AC-4)", () => {
  it("200으로 시드 프로필+매장을 반환한다", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.name).toBe("김민정");
    expect(body.profile.phone).toBe("010-3126-7299");
    expect(body.store.name).toBe("매머드커피 익스프레스 마석경춘로점");
  });
});

describe("PATCH /api/profile — 휴대폰 갱신 (AC-5)", () => {
  it("phone 변경 후 직후 GET에서 동일 조회된다", async () => {
    const res = await PATCH(patchReq({ phone: "010-1234-5678" }));
    expect(res.status).toBe(200);
    expect((await res.json()).profile.phone).toBe("010-1234-5678");

    const after = await (await GET()).json();
    expect(after.profile.phone).toBe("010-1234-5678");
  });
});

describe("PATCH /api/profile — 부분 갱신 (AC-6)", () => {
  it("email만 변경하면 phone은 직전 값 유지", async () => {
    const res = await PATCH(patchReq({ email: "x@y.com" }));
    const body = await res.json();
    expect(body.profile.email).toBe("x@y.com");
    expect(body.profile.phone).toBe("010-3126-7299");
  });
});

describe("PATCH /api/profile — 읽기전용 무시 (AC-7)", () => {
  it("name/birthDate만 보내면 200이되 변경되지 않는다", async () => {
    const res = await PATCH(
      patchReq({ name: "다른이름", birthDate: "2000-01-01" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.name).toBe("김민정");
    expect(body.profile.birthDate).toBe("1986-04-06");
  });
});

describe("PATCH /api/profile — 형식 오류 400 (AC-8)", () => {
  it("잘못된 이메일은 400 + store 무변", async () => {
    const res = await PATCH(patchReq({ email: "잘못된형식" }));
    expect(res.status).toBe(400);
    expect((await (await GET()).json()).profile.email).toBe("24joy@naver.com");
  });
  it("잘못된 휴대폰은 400 + store 무변", async () => {
    const res = await PATCH(patchReq({ phone: "abc" }));
    expect(res.status).toBe(400);
    expect((await (await GET()).json()).profile.phone).toBe("010-3126-7299");
  });
});

describe("PATCH /api/profile — 빈 body (엣지#6)", () => {
  it("빈 body는 200 + 현재 profile 반환(변경 없음)", async () => {
    const res = await PATCH(patchReq({}));
    expect(res.status).toBe(200);
    expect((await res.json()).profile.phone).toBe("010-3126-7299");
  });
});
