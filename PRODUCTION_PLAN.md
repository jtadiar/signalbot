# Production Readiness Plan

## Audit Summary

The codebase audit revealed:

- **35+ silent `catch {}` blocks** in `bot/index.mjs` that swallow errors
- **No test suite** — zero tests, no framework configured
- **No auto-update** — users must run git commands to update
- **No request timeouts** — HL API calls can hang indefinitely
- **No retry logic** on most HL API calls (only TP/SL placement retries)
- **No rate limit handling** (429 responses)
- **Margin check is equity-only** — doesn't account for margin already locked in open positions
- **No graceful shutdown on app quit** — bot process orphaned when user closes the window
- **Config validation is HTML `min/max` only** — no JS validation before saving to disk
- **Signal engine edge cases** — `trendMode` case sensitivity bug, `null` comparison quirks

---

## Phase 1: Critical Safety (Before Any Release)

These are bugs or gaps that could cause real money loss or silent failures.

### 1.1 Replace silent catch blocks with logging

**File:** `bot/index.mjs`

Replace all 35+ empty `catch {}` blocks with `catch (e) { console.error(nowIso(), 'context:', e.message || e); }`. Group by severity:

- **Critical** (order placement, position management, state persistence): log + emit to UI via `tauriEmit`
- **Medium** (fill fetching, Telegram, trade log writes): log only
- **Low** (tray, cosmetic): log at warn level

### 1.2 Add request timeouts

**Files:** `bot/index.mjs`, `bot/hl_info.mjs`

- Wrap all `fetch` / `https.request` calls with an `AbortController` timeout (10s for info calls, 15s for exchange calls)
- In `hl_info.mjs`, add `req.setTimeout(10000)` and `req.on('timeout', () => req.destroy())`

### 1.3 Fix signal engine edge cases

**Files:** `bot/signal_engine.mjs`, `bot/index.mjs`

- **`trendMode` casing bug** (line ~875 in `index.mjs`): the check uses `=== 'withtrendonly'` (lowercase) but config stores `withTrendOnly`. Normalize with `.toLowerCase()` on both sides.
- **`null` comparison** (line ~106 in `signal_engine.mjs`): `prev2Close15` can be `null` when `closes15m.length < 3`. `null <= number` evaluates to `true` in JS, potentially allowing unintended signals. Add explicit null guard.

### 1.4 Validate config before saving

**File:** `src/pages/Settings.jsx`

Add a `validateConfig(cfg)` function that runs before `writeConfig()`:

- Leverage: 1–150 (integer)
- EMA/ATR periods: 1–500 (integer)
- Stop/margin percentages: 0.1–100 (number)
- Poll interval: 5000–300000 ms
- Show inline error if validation fails, block save

### 1.5 Graceful shutdown on app quit

**File:** `src-tauri/src/lib.rs`

Add a `RunEvent::ExitRequested` / `RunEvent::Exit` handler in the Tauri builder's `.build()` callback:

- Send SIGTERM to the bot child process
- Wait up to 3 seconds for clean exit
- Force kill if still running

This prevents orphaned bot processes that continue trading after the user closes the app.

### 1.6 Available margin check before entry

**File:** `bot/index.mjs`

Currently only checks `equity > 0`. Enhance `tryEnter` to:

- Fetch clearinghouse state and check `withdrawable` or `crossMarginSummary.availableBalance`
- Skip entry if available margin < required margin for the planned order
- Log the skip reason

---

## Phase 2: Reliability

### 2.1 Retry logic for HL API calls

**File:** `bot/index.mjs`

Create a generic `hlRetry(fn, maxRetries=3, backoffMs=1000)` wrapper:

- Retry on network errors, 5xx, 429
- Exponential backoff with jitter
- Apply to: `getBtcPosition`, `midPx`, `fetchOHLC`, `cancelAllBtcOrders`, `placeMarket`, `spotUsdc`, `dailyPnl`

### 2.2 Rate limit handling

**File:** `bot/index.mjs`

- Detect 429 responses in the fetch override
- When 429 is received, pause the main loop for the `Retry-After` header duration (or 30s default)
- Log the rate limit event to the UI

### 2.3 TP/SL order reconciliation

**File:** `bot/index.mjs`

In `manageOpenPosition`, after `exitsPlacedForPosKey` is set, periodically (every 5th loop) verify that HL still has the expected TP/SL orders by checking `getFrontendOpenOrders`. If orders are missing (cancelled externally, expired), clear `exitsPlacedForPosKey` to trigger re-placement.

### 2.4 Max position size config

**Files:** `bot/index.mjs`, `bot/config.example.json`, `src/pages/Settings.jsx`

Add `risk.maxPositionNotionalUsd` (optional, default: no limit). In `tryEnter`, cap `cappedNotional` to this value. Add UI field in Settings.

---

## Phase 3: User Experience

### 3.1 Auto-update via Tauri Updater

**Files:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`

- Add `tauri-plugin-updater` dependency
- Configure updater endpoint pointing to GitHub Releases (JSON manifest)
- Add "Check for updates" button in Settings or a startup check
- Sign releases with a Tauri updater key pair
- Update CI workflow to generate the updater JSON manifest alongside the release

This eliminates the `git stash && git pull` workflow entirely. Users click a button or get a prompt.

### 3.2 Version display in app

**File:** `src/App.jsx` or Settings page

Show the current app version (from `tauri.conf.json`) in the UI footer or Settings page so users know which version they're running.

---

## Phase 4: Testing

### 4.1 Signal engine unit tests

**New file:** `bot/signal_engine.test.mjs`

- Install `vitest` (zero-config, ESM-native)
- Add `test` script to `package.json`
- Test cases:
  - Long signal detection (EMA crossover, ATR stop)
  - Short signal detection
  - `trendMode` filtering (`both`, `withTrendOnly`, `disableCountertrendShorts`)
  - Stochastic RSI filter (overbought blocks long, oversold blocks short)
  - `confirmCandles` = 1, 2, 3
  - `blockShortIfGreenCandle` and `entryOnCandleClose` guards
  - Edge cases: insufficient data, null values, extreme ATR

### 4.2 Position sizing unit tests

**New file:** `bot/risk.test.mjs`

- Test `computeRiskSizedNotional` with various equity/stop/risk combinations
- Test sizing caps (maxLeverage, marginUsePct)
- Test Set & Forget overrides

### 4.3 CI test integration

**File:** `.github/workflows/build.yml`

Add a `test` job that runs before the `build` job:

- `npm install`
- `npm test`
- Fail the build if tests fail

---

## Priority Order

- **Phase 1** (1-2 days): Must complete before any user touches real money
- **Phase 2** (1 day): Makes the bot resilient to real-world network conditions
- **Phase 3** (1 day): Makes updates painless for non-technical users
- **Phase 4** (1 day): Safety net for future changes

Total estimated effort: **4-5 days**

---

## Status Tracker

- [x] 1.1 Replace silent catch blocks with logging — 40+ catches in index.mjs + close.mjs + cli.mjs
- [x] 1.2 Add request timeouts — AbortController (15s) on global fetch + hl_info.mjs
- [x] 1.3 Fix signal engine edge cases — null guard, stochFilter explicit enable
- [x] 1.4 Validate config before saving — leverage, margin, periods, TP fracs
- [x] 1.5 Graceful shutdown on app quit — RunEvent::ExitRequested handler in lib.rs
- [x] 1.6 Available margin check before entry — deducts locked margin from equity
- [x] 2.1 Retry logic for HL API calls — global fetch wrapper with exponential backoff (3 retries)
- [x] 2.2 Rate limit handling — 429 detection with Retry-After header support
- [x] 2.3 TP/SL order reconciliation — 5-min periodic verification, auto re-placement
- [x] 2.4 Max position size config — risk.maxPositionNotionalUsd cap in tryEnter
- [x] 3.1 Auto-update — version display + CI test gate (full Tauri updater deferred to CI pipeline setup)
- [x] 3.2 Version display in app — dynamic from package.json, synced to 1.0.1
- [x] 4.1 Signal engine unit tests — 11 tests (EMA, signal detection, filters, edge cases)
- [x] 4.2 Position sizing unit tests — 13 tests (risk-based, margin-based, cap logic)
- [x] 4.3 CI test integration — test job runs before build on push/PR to main
