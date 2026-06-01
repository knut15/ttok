import { describe, it, expect, beforeEach } from "vitest";
import { POST, DELETE } from "./route";
import { __resetStore, listFixedShifts } from "@/lib/store";
import { MASTER_ID, DEFAULT_CREW_ID } from "@/lib/constants";

const JSON_H = { "Content-Type": "application/json" };
const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID, ...JSON_H };
const MANAGER = { "x-role": "crew", "x-crew-id": DEFAULT_CREW_ID, ...JSON_H }; // 김민정=매니저
const PLAIN_CREW = { "x-role": "crew", "x-crew-id": "crew-2", ...JSON_H };

function req(method: "POST" | "DELETE", body: unknown, headers: Record<string, string>) {
  return new Request("http://localhost/api/schedule/fixed", {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => __resetStore());

describe("POST /api/schedule/fixed — 고정 근무 등록(요일 선택)", () => {
  const VALID = { crewId: "crew-3", weekdays: [1, 2, 3], startTime: "09:00", endTime: "12:00" };

  it("마스터/매니저는 등록 가능 → 200", async () => {
    expect((await POST(req("POST", VALID, MASTER))).status).toBe(200);
    expect((await POST(req("POST", VALID, MANAGER))).status).toBe(200);
  });

  it("일반 크루는 등록 불가 → 403", async () => {
    expect((await POST(req("POST", VALID, PLAIN_CREW))).status).toBe(403);
  });

  it("요일 미선택(빈 배열) → 400", async () => {
    expect((await POST(req("POST", { ...VALID, weekdays: [] }, MASTER))).status).toBe(400);
  });

  it("요일 범위 밖(7) → 400", async () => {
    expect((await POST(req("POST", { ...VALID, weekdays: [1, 7] }, MASTER))).status).toBe(400);
  });

  it("종료<=시작 → 400", async () => {
    expect((await POST(req("POST", { ...VALID, startTime: "12:00", endTime: "09:00" }, MASTER))).status).toBe(400);
  });

  it("없는/비근무자 crewId → 400", async () => {
    expect((await POST(req("POST", { ...VALID, crewId: "nope" }, MASTER))).status).toBe(400);
  });

  it("등록 후 store 에 요일이 반영된다", async () => {
    await POST(req("POST", VALID, MASTER));
    const f = listFixedShifts().find((x) => x.crewId === "crew-3");
    expect(f?.weekdays).toEqual([1, 2, 3]);
  });
});

describe("DELETE /api/schedule/fixed — 고정 근무 해제", () => {
  it("시드 고정근무 해제 → 200", async () => {
    expect((await DELETE(req("DELETE", { crewId: DEFAULT_CREW_ID }, MASTER))).status).toBe(200);
  });

  it("없는 고정근무 해제 → 404", async () => {
    expect((await DELETE(req("DELETE", { crewId: "crew-3" }, MASTER))).status).toBe(404);
  });

  it("일반 크루는 해제 불가 → 403", async () => {
    expect((await DELETE(req("DELETE", { crewId: DEFAULT_CREW_ID }, PLAIN_CREW))).status).toBe(403);
  });
});
