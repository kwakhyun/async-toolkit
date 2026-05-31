# async-toolkit

**The async primitives you reach for in every project — in one zero-dependency, tree-shakeable package that works in both ESM _and_ CommonJS.**

Instead of installing and version-juggling `p-retry` + `p-limit` + `p-timeout` + `p-map` + `await-to-js` separately, get them all from one cohesive, fully-typed toolkit.

- 🪶 **Zero dependencies**, fully tree-shakeable — unused helpers add nothing to your bundle
- 🔀 **ESM _and_ CommonJS** — unlike the `p-*` family, which is ESM-only
- 🔒 **First-class TypeScript** — generics, narrowing, and a shared `AbortSignal` convention across every helper that waits or does work (`sleep`, `retry`, `timeout`, `pMap`)
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

const data = await retry((attempt, signal) => fetchFlaky({ signal }), {
  attempts: 5,      // total tries incl. the first (default 3)
  delay: 200,       // base delay ms (default 100)
  factor: 2,        // backoff multiplier (default 2)
  maxDelay: 5000,   // cap per-wait delay
  jitter: true,     // randomize delays to avoid thundering herds
  shouldRetry: async (err) => err instanceof NetworkError, // sync or async
  onRetry: (err, attempt) => console.warn(`retry #${attempt}`, err),
});
```

`fn` receives the attempt number and the `signal`. Aborting the signal rejects
with `AbortError` and **interrupts the in-flight attempt immediately** — even if
`fn` ignores the signal — as well as cancelling any pending backoff wait.

### `timeout` — bound latency

```ts
import { timeout, TimeoutError } from "async-toolkit";

try {
  const data = await timeout(fetch(url), 5000);
} catch (err) {
  if (err instanceof TimeoutError) console.log(`timed out after ${err.ms}ms`);
}
```

Pass an `AbortSignal` as the third argument to reject the wait early with
`AbortError`.

To **actually cancel** the underlying work on timeout (not just stop waiting),
pass a `(signal) => Promise` factory instead of a promise. `timeout` aborts that
signal when the deadline passes or the external signal fires, so the work frees
its resources:

```ts
// the fetch is aborted when the 5s deadline passes
const data = await timeout((signal) => fetch(url, { signal }), 5000);

// also cancellable from outside
const ac = new AbortController();
const data = await timeout((signal) => fetch(url, { signal }), 5000, ac.signal);
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

const bodies = await pMap(
  urls,
  // each mapper gets a signal that aborts if the map is cancelled
  (url, _i, signal) => fetch(url, { signal }).then((r) => r.text()),
  {
    concurrency: 4,
    stopOnError: false, // aggregate failures into an AggregateError
    signal: ac.signal,  // abort early, discarding queued mappers
  },
);
```

Results are returned in input order regardless of which mapper settles first.
The mapper's third argument is an `AbortSignal` that fires when the map is
cancelled — via `signal`, or (with `stopOnError`) when a sibling mapper fails —
so in-flight mappers can stop their own work instead of running on in vain.

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
| `timeout(promise, ms, signal?)` | Rejects with `TimeoutError` if `promise` is too slow, or `AbortError` if `signal` aborts. |
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
