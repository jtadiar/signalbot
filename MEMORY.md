# MEMORY.md

## Identity
- Assistant name: **C13**.

## Projects / Documents
- Source folders on macOS: `~/Documents/c13-memory` and `~/Documents/morph-hub`.
- These are mirrored into the OpenClaw workspace at:
  - `documents/c13-memory`
  - `documents/morph-hub`
  (synced via rsync `--delete` as a snapshot at time of sync).

## Weekly content tasks (canonical)
- Monday 08:00 report: **Weekly Crypto Reports** — roundup of the week just ended
  - Themes: AI + agentic economy; payment rails; stablecoins; emerging markets + crypto; cross-border payments (mention Morph where relevant)
  - Canonical structure: `documents/c13-memory/weekly_crypto_report_structure.md`
  - Canonical source list: `documents/c13-memory/crypto_report_research_sources.md`
  - Notion storage: database “Weekly Crypto Reports” (database_id `985d5f23-ae76-4b4b-8e40-3fd511cb1567`, data_source_id `26c0976a-b293-4570-beb5-4c90690e666e`) under page “🐍 C13 Hub”.
  - Automation: generator job `b37364f5-7bc4-4e69-aa33-53f1015a0673` + backup reminder `2e00e8b0-83d4-472a-bed4-38f50a0d7671`.
- Wednesday 10:00 article: **Musings from Joey at the Hub** (first-person Joey)
  - AI creative workflows; new tools/updates; building in Web3; product+AI+design; branding; communication through content.
- Sunday 18:00 automation:
  - Add 3 Short Script Ideas: job `7357d779-fa22-49f3-8899-5c92258fc849`.
  - Add 1 Monday Article Idea + 1 Wednesday Article Idea: job `aaa65b31-91a8-4932-9f36-a844e7559cf3`.

## Notion home
- 🐍 C13 Hub: https://www.notion.so/C13-Hub-2f82672dda0b8129b493f604410fb2c4

## Accounts / Access
- Telegram: pairing approved for user id **8294671532**.
- Notion: API key stored locally at `~/.config/notion/api_key` (do not share). Verified access to page “🐍 C13 Hub”.
- Notion: created page “Article Ideas” under 🐍 C13 Hub with two inline databases:
  - Monday Article Ideas (data_source_id `dac1541a-2c24-48f2-b9e6-fa82221bd507`)
  - Wednesday Article Ideas (data_source_id `6afbde31-4841-4c23-9d3f-219b8749de42`)
  (each has properties: Title, Description)

- Notion: created page “Short Script Ideas” under 🐍 C13 Hub with an inline database “Short Script Ideas” (database_id `be2d34fa-bba6-4e79-b9ce-67c192461cba`, data_source_id `fc29279d-a2de-4b2c-960e-826a176856b0`) with properties: Title, Description. Each item contains a 60-second TikTok-friendly script in the page body. Active page URL: https://www.notion.so/Short-Script-Ideas-2f82672dda0b8142962affa5b5b7e6c0

## User
- Name: **Joey**.
- Creative director/founder, hands-on product builder at the intersection of design, consumer products, AI, Web3.
- Communication style: direct, conversational; prefers clarity over hedging/fluff.
- Operating manual: `documents/c13-memory/joey-operating-manual.md`.

## Writing preferences (Morph Hub)
- Avoid em dashes (—) in published articles.
- Use `-` sparingly.
- Tone: professional but casually written, backed by references.
- Articles must show metadata: Date, Read Time, Title, Author (Joey Tadiar), and list must be sorted newest-first.
