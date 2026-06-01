import { describe, it, expect, beforeEach } from "vitest";
import { PATCH } from "./route";
import { __resetStore, isManagerCrew } from "@/lib/store";
import { MASTER_ID, DEFAULT_CREW_ID } from "@/lib/constants";

const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID, "Content-Type": "application/json" } as const;

function patch(id: string, body: unknown, headers: Record<string, string> = MASTER) {
  return new Request(`http://localhost/api/master/crews/${id}/manager`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/master/crews/[id]/manager (T17)", () => {
  beforeEach(() => __resetStore());

  it("마스터가 일반 크루를 매니저로 지정한다 → 200 + isManager 반영", async () => {
    const res = await PATCH(patch("crew-2", { on: true }), ctx("crew-2"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crew.isManager).toBe(true);
    expect(isManagerCrew("crew-2")).toBe(true);
  });

  it("매니저 해제 → isManager false", async () => {
    const res = await PATCH(patch(DEFAULT_CREW_ID, { on: false }), ctx(DEFAULT_CREW_ID));
    expect(res.status).toBe(200);
    expect(isManagerCrew(DEFAULT_CREW_ID)).toBe(false);
  });

  it("크루 역할은 토글 불가 → 403", async () => {
    const res = await PATCH(
      patch("crew-2", { on: true }, { "x-role": "crew", "x-crew-id": "crew-2", "Content-Type": "application/json" }),
      ctx("crew-2"),
    );
    expect(res.status).toBe(403);
  });

  it("on 누락 → 400", async () => {
    const res = await PATCH(patch("crew-2", {}), ctx("crew-2"));
    expect(res.status).toBe(400);
  });

  it("없는 크루 / master 대상 → 404", async () => {
    expect((await PATCH(patch("nope", { on: true }), ctx("nope"))).status).toBe(404);
    expect((await PATCH(patch(MASTER_ID, { on: true }), ctx(MASTER_ID))).status).toBe(404);
  });
});
