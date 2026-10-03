/**
 * Cancellation helper for data-loading effects.
 *
 * Two problems show up when an effect refetches because a dependency changed:
 * the previous request keeps running, and its response can land after the newer
 * one and overwrite fresh state. A guard fixes both — it aborts the prior
 * request and tells the caller whether its own response is still the current one.
 *
 *     const guard = useMemo(() => createRequestGuard(), []);
 *     useEffect(() => {
 *       const signal = guard.start();
 *       getMediaDetails('movie', id, { signal })
 *         .then((data) => { if (guard.isCurrent(signal)) setMovie(data); })
 *         .catch((err) => { if (guard.isCurrent(signal) && err.name !== 'AbortError') setError(err); });
 *       return () => guard.abort();
 *     }, [id, guard]);
 */

export function createRequestGuard() {
  let controller = null;

  return {
    /** Abort any prior request and begin a new one. Returns its signal. */
    start() {
      controller?.abort();
      controller = new AbortController();
      return controller.signal;
    },

    /** True only for the signal handed out by the most recent `start()`. */
    isCurrent(signal) {
      return controller !== null && controller.signal === signal;
    },

    abort() {
      controller?.abort();
      controller = null;
    },
  };
}

/** True for the abort rejections we raise ourselves, which are not failures. */
export function isAbortError(error) {
  return error?.name === 'AbortError' || error?.name === 'CanceledError';
}