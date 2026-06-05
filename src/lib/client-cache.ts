// 경량 클라이언트 GET 캐시(perf). 두 가지만 한다:
//  1) in-flight dedup — 같은 key 의 동시 호출은 단일 fetch 를 공유(여러 컴포넌트가 같은 엔드포인트 호출 → 1요청).
//  2) 짧은 TTL 캐시 — 화면 재진입/리렌더 시 즉시 반환(blank→pop 제거). mutation 은 invalidate 로 무효화.
// 서버는 여전히 매번 fresh 계산(no-store 유지) — 이 캐시는 "클라이언트가 중복 요청을 안 내게" 할 뿐.
//
// cross-user 안전(E-3): key 에 반드시 crewId(scope)를 포함시킨다(호출부 책임) — 타인 데이터 1프레임도 노출 0.
// 실패(!ok/throw)는 캐시하지 않고 null 반환(호출부가 기본값 매핑) → 다음 호출에서 재시도.

interface Entry {
  ts: number;
  data: unknown;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export const DEFAULT_TTL_MS = 10_000;

/** key 로 캐시/dedup 되는 GET. 성공 시 T, 실패 시 null. init 에 authHeaders 포함시키되 key 에 crewId 를 넣을 것. */
export function cachedJSON<T>(
  key: string,
  url: string,
  init: RequestInit,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) {
    return Promise.resolve(hit.data as T);
  }
  const existing = inflight.get(key) as Promise<T | null> | undefined;
  if (existing) return existing;

  const p: Promise<T | null> = fetch(url, init)
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as T;
      cache.set(key, { ts: Date.now(), data });
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/** prefix 로 시작하는 캐시·in-flight 무효화(mutation 후 다음 read 가 fresh 하도록). */
export function invalidateCache(prefix: string): void {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
  for (const k of inflight.keys()) if (k.startsWith(prefix)) inflight.delete(k);
}

/** mutation 응답으로 받은 최신 데이터를 캐시에 즉시 반영(다음 read 가 그 값을 즉시 사용). */
export function primeCache(key: string, data: unknown): void {
  cache.set(key, { ts: Date.now(), data });
}

/** 테스트/로그아웃 시 전체 비우기. */
export function resetClientCache(): void {
  cache.clear();
  inflight.clear();
}
