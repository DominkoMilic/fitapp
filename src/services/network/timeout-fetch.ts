/**
 * fetch with a timeout (audit fix: requests could hang forever on a bad connection, leaving
 * spinners up). Uploads, downloads and Edge Functions get longer than plain API reads.
 * Uses AbortController directly (AbortSignal.timeout/any aren't available everywhere in RN) and
 * still honours an abort signal passed by the caller.
 */
export const TIMEOUTS = { api: 20_000, long: 60_000 } as const;

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`The request took longer than ${Math.round(ms / 1000)} s`);
    this.name = 'RequestTimeoutError';
  }
}

const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

export function timeoutFor(url: string): number {
  return /\/(storage|functions)\/v1\//.test(url) ? TIMEOUTS.long : TIMEOUTS.api;
}

export function createTimeoutFetch(base: typeof fetch = fetch): typeof fetch {
  return (input, init = {}) => {
    const ms = timeoutFor(urlOf(input));
    const controller = new AbortController();
    const outer = init.signal;
    let timedOut = false;
    const onOuterAbort = () => controller.abort(outer?.reason);
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason);
      else outer.addEventListener('abort', onOuterAbort);
    }
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
    return base(input, { ...init, signal: controller.signal })
      .catch((e: unknown) => {
        throw timedOut ? new RequestTimeoutError(ms) : e;
      })
      .finally(() => {
        clearTimeout(timer);
        outer?.removeEventListener('abort', onOuterAbort);
      });
  };
}
