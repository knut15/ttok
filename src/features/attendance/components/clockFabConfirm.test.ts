import { describe, it, expect } from "vitest";
import { clockOutConfirmMessage } from "./clockFabConfirm";

describe("clockOutConfirmMessage (D: 퇴근 확인 대화상자 문구)", () => {
  it("현재 시각(HH:MM)을 담은 퇴근 확인 메시지를 만든다", () => {
    const msg = clockOutConfirmMessage(new Date(2026, 5, 1, 9, 5));
    expect(msg).toBe("현재 시각 09:05에 퇴근 처리할까요?");
  });

  it("now 미주입 시에도 HH:MM 형식 문구를 만든다", () => {
    const msg = clockOutConfirmMessage();
    expect(msg).toMatch(/^현재 시각 \d{2}:\d{2}에 퇴근 처리할까요\?$/);
  });
});
