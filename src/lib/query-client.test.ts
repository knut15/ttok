import { describe, expect, it } from "vitest";
import {
  createAppQueryClient,
  QUERY_GC_MS,
  QUERY_STALE_MS,
} from "./query-client";

describe("createAppQueryClient", () => {
  it("페이지 재진입 시 캐시 데이터를 즉시 보여주도록 stale/gc 기본값을 설정한다", () => {
    const client = createAppQueryClient();
    const options = client.getDefaultOptions().queries;

    expect(options?.staleTime).toBe(QUERY_STALE_MS);
    expect(options?.gcTime).toBe(QUERY_GC_MS);
    expect(options?.refetchOnWindowFocus).toBe(false);
  });
});
