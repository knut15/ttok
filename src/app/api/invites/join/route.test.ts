import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { __resetStore, createInvite } from "@/lib/store";
import { MASTER_ID } from "@/lib/constants";

function post(body: unknown) {
  return new Request("http://localhost/api/invites/join", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/invites/join — 코드 합류 (T8-6 / AC-14 / E-2 / E-2b)", () => {
  beforeEach(() => __resetStore());

  // AC-14: 유효 미사용 코드 → 200 JoinResult, 멤버 active=true
  it("유효 미사용 코드 합류 시 200 과 JoinResult(멤버 active=true) 를 반환한다", async () => {
    const invite = createInvite(MASTER_ID);
    const res = await POST(post({ code: invite.code, crewId: "crew-2" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.crew.id).toBe("crew-2");
    expect(body.crew.active).toBe(true);
  });

  // E-2: 없는 코드 → 400
  it("없는 코드 합류 시도는 400 을 반환한다", async () => {
    const res = await POST(post({ code: "NOPE99", crewId: "crew-2" }));
    expect(res.status).toBe(400);
  });

  // E-2b: 이미 사용된 코드 → 409
  it("이미 사용된 코드 재사용은 409 를 반환한다", async () => {
    const invite = createInvite(MASTER_ID);
    await POST(post({ code: invite.code, crewId: "crew-2" }));
    const res = await POST(post({ code: invite.code, crewId: "crew-3" }));
    expect(res.status).toBe(409);
  });

  // body 누락(code/crewId) → 400
  it("code 또는 crewId 누락 시 400 을 반환한다", async () => {
    const res = await POST(post({ crewId: "crew-2" }));
    expect(res.status).toBe(400);
  });
});
