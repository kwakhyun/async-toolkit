# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-06-15

### Fixed

- **`sleep` / `timeout`: honor delays beyond `setTimeout`'s 32-bit limit.** A raw
  `setTimeout` silently clamps any delay over ~24.8 days (`2 ** 31 - 1` ms) — or
  `Infinity` — down to `1` ms, so `sleep(Infinity)` and `timeout(work, Infinity)`
  fired almost immediately instead of waiting. Long delays are now chained so they
  elapse in full; an `Infinity` delay never fires on its own (only an abort ends it).
- **`retry`: stop cleanly when aborted during an async `shouldRetry`.** An abort
  that lands while `shouldRetry` is awaiting now rejects with `AbortError` without
  invoking `onRetry` or scheduling another attempt.

### Added

- **`to`: accept a function as well as a promise.** `to(() => expr)` runs the
  function and, unlike the promise form, also captures a synchronous throw — useful
  for wrapping non-async code such as `to(() => JSON.parse(raw))`.
- **`pLimit`: mutable `concurrency`.** `limit.concurrency` can now be read and
  assigned; raising it immediately starts as many queued tasks as now fit.
- **`pLimit`: `clearQueue(reason)`.** Passing a `reason` rejects the promises of the
  discarded, not-yet-started tasks with it. With no argument the previous behavior
  (those promises stay pending) is preserved.
- **`retry`: `signal` passed to `onRetry` and `shouldRetry`.** Both callbacks now
  receive the abort signal as their third argument, matching `fn`.

## [0.4.0] - 2026

### Fixed

- `to` now defaults its error type to `unknown`.
- `pMap` preserves input order for aggregated errors.

## [0.3.0] - 2026

### Added

- `retry` passes the `signal` to `fn`, interrupts in-flight attempts on abort, and
  supports an async `shouldRetry`.
- Real work cancellation for `timeout` and `pMap` via `AbortController`.

## [0.2.0] - 2026

### Added

- `AbortSignal` support for `timeout` and `pMap`; queued mappers are cancelled and
  inputs are hardened.

[0.5.0]: https://github.com/kwakhyun/async-toolkit/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/kwakhyun/async-toolkit/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/kwakhyun/async-toolkit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/kwakhyun/async-toolkit/releases/tag/v0.2.0
