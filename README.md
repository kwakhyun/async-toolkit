# safe-async

Tiny, dependency-free async helpers for TypeScript. Four focused utilities that
you'd otherwise rewrite in every project: **error-as-value handling**,
**retry with backoff**, **timeouts**, and **concurrency limiting**.

- 🪶 **Zero dependencies**, fully tree-shakeable
- 🔒 **Type-safe** — generics and narrowing do real work
- 📦 **Dual ESM + CJS**, ships `.d.ts`
- ✅ Works in Node ≥ 18 and modern browsers

## Install

```sh
npm install safe-async
```

## Usage

### `to` — handle errors without try/catch

Resolves a promise to a `[error, value]` tuple instead of throwing.

```ts
import { to } from "safe-async";

const [err, user] = await to(fetchUser(id));
if (err) {
  return res.status(500).send(err.message);
}
console.log(user.name); // `user` is narrowed to non-null here
```

### `retry` — exponential backoff

```ts
import { retry } from "safe-async";

const data = await retry(() => fetchFlaky(), {
  attempts: 5,        // total tries, including the first (default 3)
  delay: 200,         // base delay in ms (default 100)
  factor: 2,          // backoff multiplier (default 2)
  maxDelay: 5000,     // cap per-wait delay
  jitter: true,       // randomize delays to avoid thundering herds
  shouldRetry: (err) => err instanceof NetworkError,
  onRetry: (err, attempt) => console.warn(`retry #${attempt}`, err),
});
```

Pass an `AbortSignal` to cancel a pending wait:

```ts
const controller = new AbortController();
const promise = retry(task, { signal: controller.signal });
controller.abort(); // rejects with AbortError
```

### `timeout` — bound latency

```ts
import { timeout, TimeoutError } from "safe-async";

try {
  const data = await timeout(fetch(url), 5000);
} catch (err) {
  if (err instanceof TimeoutError) console.log(`timed out after ${err.ms}ms`);
}
```

### `pLimit` — cap concurrency

```ts
import { pLimit } from "safe-async";

const limit = pLimit(2); // at most 2 in flight at once
const results = await Promise.all(
  urls.map((url) => limit(() => fetch(url))),
);

limit.activeCount;  // currently running
limit.pendingCount; // waiting in the queue
```

## API

| Export | Description |
| --- | --- |
| `to(promise)` | Resolves to `[error, null]` or `[null, value]`. |
| `retry(fn, options?)` | Retries `fn` with exponential backoff. |
| `timeout(promise, ms)` | Rejects with `TimeoutError` if `promise` is too slow. |
| `pLimit(concurrency)` | Returns a function that limits concurrent tasks. |

Types `Result`, `RetryOptions`, `LimitFunction` and errors `TimeoutError`,
`AbortError` are also exported.

## Development

```sh
npm install
npm test          # run the test suite
npm run build     # bundle to dist/
npm run typecheck # tsc --noEmit
```

## License

[MIT](./LICENSE)
