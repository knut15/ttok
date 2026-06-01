import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST as READ } from "./route";
import { POST as APPROVE } from "../master/substitutes/approve/route";
import { POST as CREATE } from "../schedule/route";
import { __resetStore, getDaySchedules } from "@/lib/store";
import { resetDb } from "@/lib/db-seed";
import { MASTER_ID, DEFAULT_CREW_ID } from "@/lib/constants";

const JSON_H = { "Content-Type": "application/json" };
const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID, ...JSON_H };
const MANAGER = { "x-role": "crew", "x-crew-id": DEFAULT_CREW_ID, ...JSON_H };
const SELF = { "x-role": "crew", "x-crew-id": DEFAULT_CREW_ID }; // 김민정 본인

const FRIDAY = "2026-06-05"; // 김민정 고정 요일 아님 → 대타

const headers = (h: Record<string, string>) =>
  new Request("http://localhost/api/notifications", { headers: h });

let storeId: string;
beforeEach(async () => {
  __resetStore();
  storeId = await resetDb();
});

describe("대타 승인 시 멤버 알림 (요구사항 1)", () => {
  it("매니저 대타 → 마스터 승인 → 해당 멤버에 알림 생성", async () => {
    // 김민정(매니저)이 금요일 본인 대타 배정 → 대기
    await CREATE(
      new Request("http://localhost/api/schedule", {
        method: "POST",
        headers: MANAGER,
        body: JSON.stringify({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00" }),
      }),
    );
    // 승인 전: 알림 없음
    let body = await (await GET(headers(SELF))).json();
    expect(body.unread).toBe(0);

    // 마스터 승인
    const id = (await getDaySchedules(storeId, FRIDAY)).find((e) => e.crewId === DEFAULT_CREW_ID)!.id;
    await APPROVE(
      new Request("http://localhost/api/master/substitutes/approve", {
        method: "POST",
        headers: MASTER,
        body: JSON.stringify({ id }),
      }),
    );

    // 승인 후: 김민정에게 알림 1
    body = await (await GET(headers(SELF))).json();
    expect(body.unread).toBe(1);
    expect(body.items[0].message).toContain("승인");
  });

  it("읽음 처리하면 unread 0", async () => {
    await CREATE(
      new Request("http://localhost/api/schedule", {
        method: "POST",
        headers: MANAGER,
        body: JSON.stringify({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00" }),
      }),
    );
    const id = (await getDaySchedules(storeId, FRIDAY)).find((e) => e.crewId === DEFAULT_CREW_ID)!.id;
    await APPROVE(
      new Request("http://localhost/api/master/substitutes/approve", {
        method: "POST",
        headers: MASTER,
        body: JSON.stringify({ id }),
      }),
    );
    await READ(new Request("http://localhost/api/notifications", { method: "POST", headers: SELF }));
    const body = await (await GET(headers(SELF))).json();
    expect(body.unread).toBe(0);
    expect(body.items.length).toBe(1); // 목록엔 남고 읽음만 처리
  });

  it("다른 멤버에게는 알림이 가지 않는다", async () => {
    await CREATE(
      new Request("http://localhost/api/schedule", {
        method: "POST",
        headers: MANAGER,
        body: JSON.stringify({ date: FRIDAY, crewId: DEFAULT_CREW_ID, startTime: "09:00", endTime: "13:00" }),
      }),
    );
    const id = (await getDaySchedules(storeId, FRIDAY)).find((e) => e.crewId === DEFAULT_CREW_ID)!.id;
    await APPROVE(
      new Request("http://localhost/api/master/substitutes/approve", {
        method: "POST",
        headers: MASTER,
        body: JSON.stringify({ id }),
      }),
    );
    const other = await (await GET(headers({ "x-role": "crew", "x-crew-id": "crew-2" }))).json();
    expect(other.unread).toBe(0);
  });
});
