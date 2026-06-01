import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { POST as APPROVE } from "./approve/route";
import { POST as CREATE } from "../../schedule/route";
import { getDaySchedules } from "@/lib/store";
import { resetDb } from "@/lib/db-seed";
import { MASTER_ID, DEFAULT_CREW_ID } from "@/lib/constants";

const JSON_H = { "Content-Type": "application/json" };
const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID, ...JSON_H };
const MANAGER = { "x-role": "crew", "x-crew-id": DEFAULT_CREW_ID, ...JSON_H }; // 김민정=매니저

const FRIDAY = "2026-06-05"; // 김민정 고정 요일(일~목) 아님 → 대타

function createReq(body: unknown, headers: Record<string, string>) {
  return new Request("http://localhost/api/schedule", { method: "POST", headers, body: JSON.stringify(body) });
}
function get(headers: Record<string, string>) {
  return new Request("http://localhost/api/master/substitutes", { headers });
}
function approveReq(id: string, headers: Record<string, string>) {
  return new Request("http://localhost/api/master/substitutes/approve", {
    method: "POST",
    headers,
    body: JSON.stringify({ id }),
  });
}

let storeId: string;
beforeEach(async () => {
  storeId = await resetDb();
});

describe("대타 승인 알림 (요구사항 1)", () => {
  it("매니저가 대타를 배정하면 승인 대기로 마스터 목록에 뜬다", async () => {
    // 김민정(매니저)이 금요일(고정 요일 아님) 본인을 배정 → 대타·대기
    await CREATE(createReq({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00" }, MANAGER));
    const res = await GET(get(MASTER));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.substitutes.length).toBe(1);
    expect(body.substitutes[0].crewName).toBe("김민정");
    expect(body.substitutes[0].approval).toBe("대기");
  });

  it("마스터가 직접 배정한 대타는 자동 승인 → 목록에 없음", async () => {
    await CREATE(createReq({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00" }, MASTER));
    const body = await (await GET(get(MASTER))).json();
    expect(body.substitutes.length).toBe(0);
  });

  it("마스터 승인 후 목록에서 사라진다", async () => {
    await CREATE(createReq({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00" }, MANAGER));
    const id = (await getDaySchedules(storeId, FRIDAY)).find((e) => e.crewId === DEFAULT_CREW_ID)!.id;
    expect((await APPROVE(approveReq(id, MASTER))).status).toBe(200);
    const body = await (await GET(get(MASTER))).json();
    expect(body.substitutes.length).toBe(0);
  });

  it("고정 요일 근무는 대타가 아니라 승인 목록에 없다", async () => {
    // 김민정 화요일(고정 요일) 변동 → 대타 아님
    await CREATE(createReq({ date: "2026-06-02", crewId: DEFAULT_CREW_ID, startTime: "13:00", endTime: "18:00" }, MANAGER));
    const body = await (await GET(get(MASTER))).json();
    expect(body.substitutes.length).toBe(0);
  });

  it("멤버/비마스터는 대타 목록·승인 불가 → 403", async () => {
    expect((await GET(get({ "x-role": "crew", "x-crew-id": "crew-2" }))).status).toBe(403);
    expect((await APPROVE(approveReq("x", { "x-role": "crew", "x-crew-id": "crew-2", ...JSON_H }))).status).toBe(403);
  });

  it("없는 id 승인 → 404", async () => {
    expect((await APPROVE(approveReq("nope", MASTER))).status).toBe(404);
  });
});
