import { describe, it, expect, beforeEach } from "vitest";
import { PUT } from "./route";
import { GET } from "../route";
import { resetDb } from "@/lib/db-seed";
import { MASTER_ID, DEFAULT_CREW_ID } from "@/lib/constants";

const JSON_H = { "Content-Type": "application/json" };
const MASTER = { "x-role": "master", "x-crew-id": MASTER_ID, ...JSON_H };
const CREW = { "x-role": "crew", "x-crew-id": DEFAULT_CREW_ID, ...JSON_H };

function put(body: unknown, headers: Record<string, string>) {
  return PUT(
    new Request("http://localhost/api/pay/statement-inputs", {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

describe("PUT /api/pay/statement-inputs", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("멤버(crew)는 저장 불가 — 403", async () => {
    const res = await put(
      { month: "2026-05", crewId: DEFAULT_CREW_ID, incomeTax: 20490 },
      CREW,
    );
    expect(res.status).toBe(403);
  });

  it("형식 불량 month → 400", async () => {
    const res = await put({ month: "2026/05", crewId: DEFAULT_CREW_ID }, MASTER);
    expect(res.status).toBe(400);
  });

  it("마스터 저장 후 해당 멤버 명세서 입력값이 조회된다(영속)", async () => {
    const saveRes = await put(
      {
        month: "2026-05",
        crewId: DEFAULT_CREW_ID,
        incentiveEnabled: true,
        monthlySales: 16_112_200,
        incomeTax: 20_490,
        nightPay: 0,
      },
      MASTER,
    );
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json();
    expect(saved.incentiveEnabled).toBe(true);
    expect(saved.monthlySales).toBe(16_112_200);

    // GET /api/pay 가 저장값을 statementInputs 로 노출(멤버 본인 조회 경로 = 본인 강제).
    const getRes = await GET(
      new Request(`http://localhost/api/pay?month=2026-05`, { headers: CREW }),
    );
    const body = await getRes.json();
    expect(body.statementInputs.incentiveEnabled).toBe(true);
    expect(body.statementInputs.incomeTax).toBe(20_490);
    expect(body.canEditStatement).toBe(false); // 멤버는 편집 불가
  });

  it("마스터 GET 은 canEditStatement=true", async () => {
    const res = await GET(
      new Request(`http://localhost/api/pay?month=2026-05&crewId=${DEFAULT_CREW_ID}`, {
        headers: MASTER,
      }),
    );
    const body = await res.json();
    expect(body.canEditStatement).toBe(true);
  });
});
