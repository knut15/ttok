import { describe, it, expect, beforeEach } from "vitest";
import { POST, PATCH, DELETE } from "./route";
import { __resetStore, listFixedShifts } from "@/lib/store";
import { resetDb } from "@/lib/db-seed";
import { MASTER_ID, DEFAULT_CREW_ID } from "@/lib/constants";

const JSON_H = { "Content-Type": "application/json" };
const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID, ...JSON_H };
const MANAGER = { "x-role": "crew", "x-crew-id": DEFAULT_CREW_ID, ...JSON_H }; // 김민정=매니저
const PLAIN_CREW = { "x-role": "crew", "x-crew-id": "crew-2", ...JSON_H };

function req(method: "POST" | "PATCH" | "DELETE", body: unknown, headers: Record<string, string>) {
  return new Request("http://localhost/api/schedule/fixed", {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

let storeId: string;
beforeEach(async () => {
  __resetStore();
  storeId = await resetDb();
});

describe("POST /api/schedule/fixed — 블록 추가", () => {
  const VALID = { crewId: "crew-3", weekdays: [1, 2, 3], startTime: "09:00", endTime: "12:00" };

  it("마스터/매니저는 추가 가능 → 200", async () => {
    expect((await POST(req("POST", VALID, MASTER))).status).toBe(200);
    expect((await POST(req("POST", { ...VALID, weekdays: [4, 5] }, MANAGER))).status).toBe(200);
  });

  it("일반 멤버는 추가 불가 → 403", async () => {
    expect((await POST(req("POST", VALID, PLAIN_CREW))).status).toBe(403);
  });

  it("같은 멤버의 기존 요일과 겹치면 → 409", async () => {
    // 김민정은 시드에 월~목 + 일 → 월(1) 겹침
    const res = await POST(req("POST", { crewId: DEFAULT_CREW_ID, weekdays: [1], startTime: "13:00", endTime: "18:00" }, MASTER));
    expect(res.status).toBe(409);
  });

  it("요일 미선택/범위 밖 → 400", async () => {
    expect((await POST(req("POST", { ...VALID, weekdays: [] }, MASTER))).status).toBe(400);
    expect((await POST(req("POST", { ...VALID, weekdays: [7] }, MASTER))).status).toBe(400);
  });

  it("종료<=시작 → 400", async () => {
    expect((await POST(req("POST", { ...VALID, startTime: "12:00", endTime: "09:00" }, MASTER))).status).toBe(400);
  });

  it("멤버당 여러 블록을 가질 수 있다", async () => {
    await POST(req("POST", VALID, MASTER));
    await POST(req("POST", { ...VALID, weekdays: [5] }, MASTER));
    expect((await listFixedShifts(storeId)).filter((f) => f.crewId === "crew-3")).toHaveLength(2);
  });
});

describe("PATCH /api/schedule/fixed — 블록 편집(id)", () => {
  it("요일·시간 편집 → 200, 반영", async () => {
    const id = (await listFixedShifts(storeId)).find((f) => f.crewId === "crew-2")!.id; // 금·토
    const res = await PATCH(req("PATCH", { id, weekdays: [6], startTime: "12:00", endTime: "16:00" }, MASTER));
    expect(res.status).toBe(200);
    const f = (await listFixedShifts(storeId)).find((x) => x.id === id)!;
    expect(f.weekdays).toEqual([6]);
    expect(f.startTime).toBe("12:00");
  });

  it("같은 멤버 다른 블록 요일과 겹치면 → 409 (자기 자신 제외)", async () => {
    // 김민정: [1,2,3,4] 블록 + [0] 블록. [0] 블록을 [1] 로 바꾸면 다른 블록과 겹침
    const sun = (await listFixedShifts(storeId)).find((f) => f.crewId === DEFAULT_CREW_ID && f.weekdays.includes(0))!;
    const res = await PATCH(req("PATCH", { id: sun.id, weekdays: [1], startTime: "10:00", endTime: "14:00" }, MASTER));
    expect(res.status).toBe(409);
  });

  it("자기 자신 요일 유지(겹침 아님) → 200", async () => {
    const sun = (await listFixedShifts(storeId)).find((f) => f.crewId === DEFAULT_CREW_ID && f.weekdays.includes(0))!;
    const res = await PATCH(req("PATCH", { id: sun.id, weekdays: [0], startTime: "09:00", endTime: "13:00" }, MASTER));
    expect(res.status).toBe(200);
  });

  it("없는 id → 404, 일반 멤버 → 403", async () => {
    expect((await PATCH(req("PATCH", { id: "nope", weekdays: [1], startTime: "09:00", endTime: "12:00" }, MASTER))).status).toBe(404);
    const id = (await listFixedShifts(storeId))[0].id;
    expect((await PATCH(req("PATCH", { id, weekdays: [1], startTime: "09:00", endTime: "12:00" }, PLAIN_CREW))).status).toBe(403);
  });
});

describe("DELETE /api/schedule/fixed — 블록 삭제(id)", () => {
  it("시드 블록 id 삭제 → 200", async () => {
    const id = (await listFixedShifts(storeId)).find((f) => f.crewId === "crew-2")!.id;
    expect((await DELETE(req("DELETE", { id }, MASTER))).status).toBe(200);
  });

  it("없는 id → 404", async () => {
    expect((await DELETE(req("DELETE", { id: "nope" }, MASTER))).status).toBe(404);
  });

  it("일반 멤버는 삭제 불가 → 403", async () => {
    const id = (await listFixedShifts(storeId))[0].id;
    expect((await DELETE(req("DELETE", { id }, PLAIN_CREW))).status).toBe(403);
  });
});
