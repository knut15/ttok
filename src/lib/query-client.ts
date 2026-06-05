import { QueryClient } from "@tanstack/react-query";

export const QUERY_STALE_MS = 60_000;
export const QUERY_GC_MS = 5 * 60_000;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_MS,
        gcTime: QUERY_GC_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
