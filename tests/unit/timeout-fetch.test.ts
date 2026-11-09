import {
  createTimeoutFetch,
  RequestTimeoutError,
  timeoutFor,
  TIMEOUTS,
} from '@/services/network/timeout-fetch';

/** A fetch that only settles when its signal aborts. */
const hanging: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });

describe('requests time out instead of hanging (audit fix)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('API reads give up after 20 s with a clear error', async () => {
    const f = createTimeoutFetch(hanging);
    const p = f('https://x.supabase.co/rest/v1/weight_entries');
    jest.advanceTimersByTime(TIMEOUTS.api);
    await expect(p).rejects.toBeInstanceOf(RequestTimeoutError);
  });
  it('uploads and functions get 60 s', () => {
    expect(timeoutFor('https://x.supabase.co/storage/v1/object/routes/a.json')).toBe(TIMEOUTS.long);
    expect(timeoutFor('https://x.supabase.co/functions/v1/delete-account')).toBe(TIMEOUTS.long);
    expect(timeoutFor('https://x.supabase.co/rest/v1/foods')).toBe(TIMEOUTS.api);
  });
  it('a caller abort still aborts, and is not reported as a timeout', async () => {
    const f = createTimeoutFetch(hanging);
    const c = new AbortController();
    const p = f('https://x/rest/v1/a', { signal: c.signal });
    c.abort();
    await expect(p).rejects.toThrow('aborted');
  });
  it('fast responses pass through', async () => {
    const ok = createTimeoutFetch(async () => new Response('{}', { status: 200 }));
    await expect(ok('https://x/rest/v1/a')).resolves.toHaveProperty('status', 200);
  });
});
