# PRD — HL Signalbot (OpenClaw + Hyperliquid)

## 1) Summary

HL Signalbot is a **single-purpose, CLI-run trading bot** designed to be used inside an **OpenClaw workspace**, trading **Hyperliquid perpetuals** (initially BTC-PERP) based on a deterministic, transparent signal.

The bot:
- computes a signal from OHLC data (EMA trend + EMA trigger + ATR-sized stop),
- opens a position using Hyperliquid’s API,
- places native Hyperliquid **TP/SL trigger orders** (so users can see them in the HL UI),
- manages the open position (TP ladder, optional runner exit),
- sends **Telegram pings** for opens/closes/TP/SL,
- enforces risk constraints (max leverage, daily loss halt, cooldowns).

This is **not** a framework and **not** a collection of bots. It is one bot that anyone can clone and run with OpenClaw.

---

## 2) Goals

### Primary goals
- Provide a reliable, reproducible Hyperliquid trading bot with a clean CLI.
- Make setup safe and simple: users should only need to add wallet/key + optional Telegram token.
- Use OpenClaw conventions: repository-friendly, minimal external dependencies, sane defaults.
- Provide strong guardrails: daily loss halt, leverage caps, stop sizing, cooldowns.

### Non-goals
- No LLM usage required (no OpenAI keys).
- No multi-exchange support.
- No complex portfolio management.
- No UI dashboard in v1.

---

## 3) Target users

- OpenClaw users who want an automated Hyperliquid bot with transparent logic.
- Builders who want a starting point that’s easy to audit and modify.

---

## 4) User stories

1. **As a user**, I can clone the repo into my OpenClaw workspace and run one command to start the bot.
2. **As a user**, I can configure my wallet + private key securely via environment variables and/or local secret files.
3. **As a user**, I can receive Telegram pings for every open and close, including net PnL.
4. **As a user**, I can adjust risk (leverage, daily loss, stop sizing, cooldowns) via config.
5. **As a user**, I can stop the bot safely and restart without losing track of state.

---

## 5) Product requirements

### 5.1 CLI

**Command:** `hl-signalbot`

**Must support:**
- `--config <path>`: path to config JSON (defaults to `apps/hl-signalbot/config.json` or `process.env.CONFIG`).
- `--once` (optional v1.1): run one loop iteration then exit.
- `--dry-run` (optional v1.1): compute signals and log actions without placing orders.

**Exit codes:**
- `0` normal exit (when `--once`)
- `1` config/secret validation error

### 5.2 Configuration

Config is a JSON file with sections:
- `market`: coin/symbol
- `signal`: candle fetch parameters + EMA/ATR settings
- `risk`: leverage cap, daily loss halt, cooldowns, sizing
- `exits`: TP ladder, stop constraints, runner exit
- `telegram`: ping channel config

**Env overrides (required):**
- Wallet address override: `HL_WALLET_ADDRESS`
- Private key override: `HL_PRIVATE_KEY` or `HL_PRIVATE_KEY_PATH`

**Telegram env overrides (optional):**
- `TG_ENABLED`
- `TG_CHAT`
- `TG_TOKEN` or `TG_TOKEN_PATH`

### 5.3 Trading behavior

**Entry:**
- Polls market every `signal.pollMs`.
- Pulls OHLC for trigger timeframe (default 15m) and trend timeframe (default 1h).
- Computes a directional signal (long/short) and stop distance.
- Sizes position according to one of:
  - risk-based sizing (notional based on stopPct)
  - margin-use sizing (`risk.marginUsePct`)

**Exit:**
- Places native TP/SL orders on Hyperliquid.
- TP ladder defined by `exits.tp[]` with R multiples and close fractions.
- Optional runner logic: close remaining on opposite signal.

**Risk controls:**
- Halt trading if daily PnL < `-maxDailyLossUsd`.
- Enforce `risk.maxLeverage`.
- Enforce loss cooldown `risk.lossCooldownMinutes` after a net losing close.
- Optional re-entry cooldown `risk.reentryCooldownSeconds` after any exit.

### 5.4 Telegram pings

**Required message types:**
- OPEN: side, size, entry price, stop, TP ladder summary
- CLOSE: direction, size, exit price, net PnL (closedPnl - fee), timestamp

**Anti-spam:**
- Deduplicate identical messages within a short window.

### 5.5 State persistence

State file should persist:
- last action timestamps
- last exit timestamps
- loss timestamp (`lastLossAtMs`)
- whether TP1/TP2 has been hit
- cursor for fills pinging

**Constraints:**
- State must not contain secrets.
- State should be ignored by git.

---

## 6) Security requirements

### 6.1 Secrets handling
- Do not store private keys or Telegram tokens in tracked files.
- Support env var injection for all secrets.
- If a secret is provided via a file path, recommend `chmod 600`.

### 6.2 Operational safety
- Fail fast if required secrets are missing.
- Print clear setup errors without leaking secrets.
- Avoid writing sensitive data to logs.

### 6.3 Trading safety
- Always place protective TP/SL after entry; if protection placement fails, close position (best effort).
- Cap leverage and daily loss.

---

## 7) Observability requirements

- Console logs for:
  - startup config summary (non-secret)
  - every decision: signal/no signal
  - every order action and response status (no secrets)
  - halt events and cooldown triggers

- Optional (future): JSONL event log for opens/closes.

---

## 8) Distribution requirements

Repository must include:
- `apps/hl-signalbot/README.md` with setup instructions
- `apps/hl-signalbot/.env.example`
- `apps/hl-signalbot/.gitignore` (ignore state + secrets)
- clean CLI entrypoint (`cli.mjs`) and package scripts (`npm start`)

---

## 9) Acceptance criteria

- A new user can:
  1) clone repo into OpenClaw workspace
  2) run `npm ci`
  3) set secrets via `.env`
  4) start bot with `npm start`
  5) observe Telegram pings on open/close

- No secrets are stored in git-tracked files.
- Bot halts when max daily loss is exceeded.

---

## 10) Out of scope (future)

- Multi-coin support
- Web UI/dashboard
- Backtesting suite
- Strategies beyond EMA/ATR baseline
- Unit/integration tests
