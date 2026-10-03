/**
 * Single HTTP entry point for the JinFlix backend.
 *
 * The browser never talks to TMDb directly — the backend owns the API key,
 * normalization, and caching. This module adds the three things the API layer
 * cannot do for us:
 *
 *   - a short-lived response cache, so remounting a page is free
 *   - in-flight request de-duplication, so parallel effects share one request
 *   - cooperative cancellation, so a stale response can never overwrite a
 *     newer one (see `raceAbort` below)
 */

/**
 * Origin of the JinFlix backend, with no trailing slash and no `/api` suffix —
 * request paths in ./media.js already carry that prefix.
 *
 * Leave empty to call same-origin, which is what the Vite dev proxy and a
 * reverse-proxied production deploy both expect.
 */
const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const API_BASE_URL = String(RAW_BASE_URL).trim().replace(/\/+$/, '');

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 120;

const responseCache = new Map();
const inFlight = new Map();

function readCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    responseCache.delete(key);
    return undefined;
  }

  // Refresh recency for the LRU eviction below.
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
}

function writeCache(key, value) {
  if (responseCache.has(key)) responseCache.delete(key);
  responseCache.set(key, { storedAt: Date.now(), value });

  while (responseCache.size > CACHE_MAX_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    responseCache.delete(oldest);
  }
}

export class ApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? 0;
    this.cause = cause;
  }
}

/**
 * Build a stable cache key from a path and its params, ignoring key order so
 * `{a,b}` and `{b,a}` are the same request.
 */
function cacheKeyFor(path, params) {
  if (!params) return path;
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? `${path}?${new URLSearchParams(entries)}` : path;
}

/**
 * Let a caller walk away from a shared result without killing it.
 *
 * The request belongs to the cache, not to any one caller, so aborting a
 * caller's signal must only reject *that caller's* wait. If the signal were
 * handed to `fetch` directly, one caller aborting would fail every other caller
 * sharing the request — which is exactly what broke first paint under
 * StrictMode, where the mount effect aborts and immediately re-runs and would
 * otherwise join its own dying request.
 *
 * `value` may be an in-flight promise or an already-cached payload, so it is
 * wrapped before `.then` is attached. Passing a bare object straight through
 * would throw "then is not a function" and take the whole page down with it.
 */
function raceAbort(value, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Request aborted', 'AbortError'));

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });
    const settle = (handler) => (result) => {
      signal.removeEventListener('abort', onAbort);
      handler(result);
    };
    Promise.resolve(value).then(settle(resolve), settle(reject));
  });
}

/**
 * GET a JSON payload.
 *
 * `force` bypasses the cache — use it only for genuinely fresh data.
 */
export async function getJson(path, params, options = {}) {
  const { signal, force = false } = options;
  const key = cacheKeyFor(path, params);

  if (!force && signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }

  if (!force) {
    const cached = readCache(key);
    if (cached !== undefined) return signal ? raceAbort(cached, signal) : cached;
  }

  const query = params
    ? Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
        .join('&')
    : '';

  const target = `${API_BASE_URL}${path}${query ? `?${query}` : ''}`;
  // Relative targets are resolved against the current page by the browser.
  const url = API_BASE_URL ? new URL(target) : target;

  // A de-duplicated request already in flight is reused as-is.
  let request = inFlight.get(key);

  if (!request) {
    // The shared request owns its own controller. Caller signals are applied
    // with `raceAbort` below, so aborting one caller leaves the shared request
    // (and every other waiter, plus the cache) intact.
    const controller = new AbortController();

    request = fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          let detail = `Request failed with status ${response.status}`;
          try {
            const body = await response.json();
            if (body?.detail) detail = body.detail;
          } catch {
            // Non-JSON error body; the status-derived message is good enough.
          }
          throw new ApiError(detail, { status: response.status });
        }
        return response.json();
      })
      .then((value) => {
        writeCache(key, value);
        return value;
      })
      .finally(() => {
        if (inFlight.get(key) === request) inFlight.delete(key);
      });

    inFlight.set(key, request);
  }

  return signal ? raceAbort(request, signal) : request;
}

/** Drop cached responses so the next read hits the network. */
export function invalidateCache(prefix = '') {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key);
  }
}