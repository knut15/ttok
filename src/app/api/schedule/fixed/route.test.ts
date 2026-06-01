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

describe("POST /api/schedule/fixed — 고정 근무 등록", () => {
  const VALID = { crewId: "crew-3", dayType: "weekday", startTime: "09:00", endTime: "12:00" };

  it("마스터/매니저는 등록 가능 → 200", async () => {
    expect((await POST(req("POST", VALID, MASTER))).status).toBe(200);
    expect((await POST(req("POST", VALID, MANAGER))).status).toBe(200);
  });

  it("일반 크루는 등록 불가 → 403", async () => {
    expect((await POST(req("POST", VALID, PLAIN_CREW))).status).toBe(403);
  });

  it("운영시간(평일 08~19) 밖이면 400", async () => {
    const res = await POST(req("POST", { ...VALID, startTime: "07:00", endTime: "12:00" }, MASTER));
    expect(res.status).toBe(400);
  });

  it("주말 운영시간(09~17) 밖이면 400", async () => {
    const res = await POST(
      req("POST", { crewId: "crew-3", dayType: "weekend", startTime: "08:00", endTime: "17:00" }, MASTER),
    );
    expect(res.status).toBe(400);
  });

  it("잘못된 dayType → 400", async () => {
    const res = await POST(req("POST", { ...VALID, dayType: "holiday" }, MASTER));
    expect(res.status).toBe(400);
  });

  it("등록 후 store 에 반영된다", async () => {
    await POST(req("POST", VALID, MASTER));
    expect(listFixedShifts().some((f) => f.crewId === "crew-3" && f.dayType === "weekday")).toBe(true);
  });
});

describe("DELETE /api/schedule/fixed — 고정 근무 해제", () => {
  it("시드 고정근무 해제 → 200", async () => {
    const res = await DELETE(req("DELETE", { crewId: DEFAULT_CREW_ID, dayType: "weekday" }, MASTER));
    expect(res.status).toBe(200);
  });

  it("없는 고정근무 해제 → 404", async () => {
    const res = await DELETE(req("DELETE", { crewId: "crew-3", dayType: "weekend" }, MASTER));
    expect(res.status).toBe(404);
  });

  it("일반 크루는 해제 불가 → 403", async () => {
    const res = await DELETE(req("DELETE", { crewId: DEFAULT_CREW_ID, dayType: "weekday" }, PLAIN_CREW));
    expect(res.status).toBe(403);
  });
});
