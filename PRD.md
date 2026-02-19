# PRD — HL Signalbot (OpenClaw + Hyperliquid)

> Audience: This PRD is written to be **implementation-ready** for Cursor / an AI IDE.
> It defines a product that is:
> - a **hosted web app** (dashboard + docs)
> - plus a **downloadable local runner package** that executes trades on the user’s machine
> - with the user’s **private key never leaving their device**.

---

## 1) Summary

HL Signalbot is a single-purpose Hyperliquid perpetuals signal-trading bot (initially `BTC-PERP`) designed to be run in the OpenClaw ecosystem.

The product ships as **two cooperating components**:

1) **Hosted Web App (Dashboard)**
- Marketing site + docs + onboarding
- User account
- Bot configuration UI (risk, telegram, strategy parameters)
- Shows status, trade history, PnL summaries
- Issues authenticated “jobs” to the local runner

2) **Local Runner (Downloadable Package / Agent)**
- Runs on the user’s machine (the same box as their OpenClaw workspace, or any machine)
- Holds the Hyperliquid **private key locally**
- Executes all trades via Hyperliquid API
- Sends Telegram pings
- Reports status/telemetry back to hosted dashboard

This repo currently contains the Local Runner (Node.js) and documentation. The PRD below expands requirements to ship the full product.

---

## 2) Goals

### Primary goals
- **Non-developer friendly** onboarding: guided setup, minimal terminal use.
- **Security-first**: private keys remain local; secrets stored in OS keychain.
- Deterministic, transparent signal logic (EMA/ATR baseline) with strong guardrails.
- One-bot product (not a framework, not multiple bots).
- Telegram pings for opens/closes/TP/SL.

### Non-goals (v1)
- No custody (we do not hold user keys).
- No multi-exchange.
- No social trading / copy trading.
- No complex portfolio management.

---

## 3) Target users

- Non-developers who can follow step-by-step instructions.
- OpenClaw users who want a Hyperliquid bot with transparent logic.

---

## 4) Critical user story (end-to-end)

**As a new user**, I can:
1) visit the hosted dashboard
2) create an account
3) download the local runner for my OS
4) run a guided setup wizard (UI or CLI)
5) enter my wallet address + private key locally (never uploaded)
6) connect Telegram pings
7) deposit USDC to Hyperliquid / fund my trading account
8) click “Start” and see the bot trade + ping Telegram

---

## 5) Product requirements (Hosted Web App)

### 5.1 Core pages

- **Landing**: what it does, risk disclaimers, screenshots.
- **Docs**: setup guides by OS, troubleshooting.
- **Dashboard**:
  - runner connection status (connected/disconnected, last heartbeat)
  - current position summary
  - open orders (TP/SL)
  - last signal + reason
  - daily PnL and max daily loss line
  - trade history (open/close events)
- **Settings**:
  - strategy params (EMA periods, ATR, maxStopPct)
  - risk params (max leverage, maxDailyLossUsd, cooldowns)
  - telegram config (chat + token management UX; token ultimately stored locally)

### 5.2 Auth & sessions

- Email/password or magic link (implementation choice).
- All server-issued commands to the runner must be authenticated.

### 5.3 Runner pairing

- Runner generates a short-lived pairing code.
- User enters pairing code in the web app.
- Server returns a signed token; runner stores it locally.

### 5.4 Telemetry & data model

Server stores (non-secret):
- runner device id, last seen
- bot config (non-secret)
- trade events: OPEN/CLOSE, timestamp, coin, side, size, entry/exit px, net pnl
- health events: HALT, ERROR streak, backoff

No private keys or Telegram bot tokens are stored server-side.

---

## 6) Product requirements (Local Runner)

### 6.1 Distribution

Provide downloadable builds for:
- macOS (arm64 + x64 if needed)
- Windows
- Linux

Acceptable packaging options (pick one):
- Node.js + `pkg`/`nexe` single binary
- Electron/Tauri “Runner App” (tray app) — optional in v1
- A simple `npm` install is allowed for developer mode, but **must not be the primary non-dev path**.

### 6.2 Setup UX (must be non-dev friendly)

The runner must provide a setup wizard:

- **GUI wizard** (preferred) served on `http://localhost:<port>` and opened automatically, OR a Tauri/Electron wizard.
- Minimal CLI fallback: `hl-signalbot setup`.

Wizard flow:
1) Choose coin (default BTC)
2) Enter wallet address
3) Enter private key (masked)
4) Choose secret storage: OS keychain (default)
5) Telegram pings setup (optional)
6) Risk controls (max leverage, max daily loss)
7) Confirm → start runner

### 6.3 Secret storage

- Store secrets in OS keychain/credential vault:
  - macOS Keychain
  - Windows Credential Manager
  - Linux Secret Service / libsecret (fallback to encrypted local file with a user-chosen passphrase)

Secrets:
- Hyperliquid private key
- Telegram bot token (if used)
- Runner auth token for dashboard

### 6.4 Runner API (local)

Runner exposes a local API for:
- start/stop
- status
- logs tail
- update config

This can be:
- localhost HTTP server with a local-only origin, plus CSRF protection, OR
- IPC if using a desktop shell.

### 6.5 Trading logic

Entry/exit logic remains as in current code:
- EMA/ATR-based signal
- Places native TP/SL triggers on HL
- Cooldowns:
  - after loss: `lossCooldownMinutes`
  - after any exit: `reentryCooldownSeconds`
- daily loss halt

### 6.6 Telegram pings

Runner must support Telegram pings:
- OPEN
- TP/CLOSE
- STOP/LOSS

Telegram must be configurable in the wizard.

---

## 7) Funding / USDC deposit instructions (required in docs)

Docs must include a clear, step-by-step section explaining funding:

- The bot trades perps and needs margin.
- User must have **USDC available for trading on Hyperliquid**.
- Instructions should cover:
  1) Use the same wallet address the runner is configured with.
  2) Deposit/bridge USDC to the correct chain/network used by Hyperliquid.
  3) Transfer USDC into the Hyperliquid trading account / margin account (as per HL UI).
  4) Confirm equity is visible before starting the bot.

> Note: exact UI steps may change; docs should be written to be resilient and include screenshots/video links when possible.

---

## 8) Security requirements

- Private keys never leave the device.
- Hosted dashboard never receives keys or Telegram tokens.
- No secrets committed to git.
- Strong risk guardrails enabled by default:
  - maxDailyLossUsd
  - max leverage
  - mandatory protective TP/SL after entry (close position if cannot place protection)
- Prevent double-running against the same wallet (process lock).

---

## 9) Observability requirements

Runner must produce:
- human-readable logs
- structured event log (JSONL)

Dashboard must show:
- last heartbeat
- last error
- last trade

---

## 10) Acceptance criteria

A non-technical user can:
- install the runner on macOS/Windows
- complete setup wizard
- fund Hyperliquid with USDC
- start bot
- see Telegram pings
- view trade history in dashboard

---

## 11) Implementation plan (instructions for Cursor / AI IDE)

Build in this order:

1) **Runner hardening**
- add process lock
- add `setup` command
- add keychain storage
- add `status` and `stop`

2) **Local setup UI**
- serve local wizard (React/Vite or minimal HTML)
- write settings + secrets to keychain

3) **Hosted dashboard**
- auth
- pairing
- status ingestion
- config publishing

4) **Packaging**
- build installers / binaries per OS
- signing (macOS notarization, Windows signing) if distributing widely

5) **Docs**
- include USDC funding instructions
- include Telegram setup
- add troubleshooting and safe defaults
