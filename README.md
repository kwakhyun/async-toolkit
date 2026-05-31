# async-toolkit

**The async primitives you reach for in every project — in one zero-dependency, tree-shakeable package that works in both ESM _and_ CommonJS.**

Instead of installing and version-juggling `p-retry` + `p-limit` + `p-timeout` + `p-map` + `await-to-js` separately, get them all from one cohesive, fully-typed toolkit.

- 🪶 **Zero dependencies**, fully tree-shakeable — unused helpers add nothing to your bundle
- 🔀 **ESM _and_ CommonJS** — unlike the `p-*` family, which is ESM-only
- 🔒 **First-class TypeScript** — generics, narrowing, and a shared `AbortSignal` convention across every helper
- ✅ Works in Node ≥ 18 and modern browsers

## Why not just use `p-retry`, `p-limit`, …?

Those are excellent packages (and the inspiration here), but they have two friction points this toolkit removes:

| | `p-*` family | **async-toolkit** |
| --- | --- | --- |
| Install footprint | one package **per** helper | **one** package |
| Module formats | **ESM only** (no `require`) | **ESM + CJS** |
| API consistency | each its own conventions | one consistent options & `AbortSignal` style |
| Bundle cost | per-package overhead | shared internals, tree-shaken |

If you're already all-ESM and only need one helper, the single-purpose packages are great. If you want **one dependency, CJS support, and a consistent API**, reach for this.

## Install

```sh
npm install async-toolkit
```

## Helpers

### `to` — handle errors without try/catch

```ts
import { to } from "async-toolkit";

const [err, user] = await to(fetchUser(id));
if (err) return res.status(500).send(err.message);
console.log(user.name); // `user` narrowed to non-null
```

### `retry` — exponential backoff

```ts
import { retry } from "async-toolkit";

const data = await retry(() => fetchFlaky(), {
  attempts: 5,      // total tries incl. the first (default 3)
  delay: 200,       // base delay ms (default 100)
  factor: 2,        // backoff multiplier (default 2)
  maxDelay: 5000,   // cap per-wait delay
  jitter: true,     // randomize delays to avoid thundering herds
  shouldRetry: (err) => err instanceof NetworkError,
  onRetry: (err, attempt) => console.warn(`retry #${attempt}`, err),
});
```

Pass an `AbortSignal` to cancel a pending wait — it rejects with `AbortError`.

### `timeout` — bound latency

```ts
import { timeout, TimeoutError } from "async-toolkit";

try {
  const data = await timeout(fetch(url), 5000);
} catch (err) {
  if (err instanceof TimeoutError) console.log(`timed out after ${err.ms}ms`);
}
```

### `pLimit` — cap concurrency

```ts
import { pLimit } from "async-toolkit";

const limit = pLimit(2); // at most 2 in flight at once
const results = await Promise.all(urls.map((url) => limit(() => fetch(url))));

limit.activeCount;  // currently running
limit.pendingCount; // waiting in the queue
```

### `pMap` — concurrency-limited map

```ts
import { pMap } from "async-toolkit";

const bodies = await pMap(urls, (url) => fetch(url).then((r) => r.text()), {
  concurrency: 4,
  stopOnError: false, // aggregate failures into an AggregateError
});
```

Results are returned in input order regardless of which mapper settles first.

### `sleep` — cancellable delay

```ts
import { sleep } from "async-toolkit";

await sleep(1000);

const ac = new AbortController();
sleep(5000, ac.signal).catch(() => console.log("cancelled"));
ac.abort();
```

### `defer` — externally-settled promise

```ts
import { defer } from "async-toolkit";

const d = defer<string>();
emitter.once("ready", () => d.resolve("ok"));
emitter.once("error", (e) => d.reject(e));
const result = await d.promise;
```

## API

| Export | Description |
| --- | --- |
| `to(promise)` | Resolves to `[error, null]` or `[null, value]`. |
| `retry(fn, options?)` | Retries `fn` with exponential backoff. |
| `timeout(promise, ms)` | Rejects with `TimeoutError` if `promise` is too slow. |
| `pLimit(concurrency)` | Returns a function that limits concurrent tasks. |
| `pMap(items, mapper, options?)` | Concurrency-limited, order-preserving async map. |
| `sleep(ms, signal?)` | Cancellable delay. |
| `defer()` | A promise plus its `resolve`/`reject`. |

Types `Result`, `RetryOptions`, `LimitFunction`, `PMapOptions`, `Deferred` and
errors `TimeoutError`, `AbortError` are also exported.

## Development

```sh
npm install
npm test          # run the test suite
npm run build     # bundle to dist/
npm run typecheck # tsc --noEmit
```

## License

[MIT](./LICENSE)
