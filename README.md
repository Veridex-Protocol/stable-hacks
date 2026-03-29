# Settla

Passkey-first Solana treasury workspace with agent-compatible payment rails, payout claims, invoices, receipts, and audit-ready settlement evidence.

Built for the **StableHacks 2026** hackathon.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router)          port 3000              │
│  ├─ /                  Landing page                      │
│  ├─ /auth              Passkey auth (local + Veridex)    │
│  ├─ /dashboard/*       Treasury control plane            │
│  ├─ /pay/[id]          Public payment page               │
│  ├─ /claim/[id]        Public payout claim page          │
│  └─ /api/auth/*        Auth relay & credential proxy     │
├──────────────────────────────────────────────────────────┤
│  Express server (tsx)             port 4179              │
│  ├─ /api/state         Dashboard state                   │
│  ├─ /api/workspace/*   Wallet, funding, links, invoices  │
│  ├─ /api/bootstrap     Treasury init                     │
│  ├─ /api/payouts       Payout queue & approvals          │
│  ├─ /api/health        Health check                      │
│  └─ /api/export        Audit export (JSON/CSV)           │
├──────────────────────────────────────────────────────────┤
│  Services                                                │
│  ├─ SolanaService      RPC, airdrops, token ops          │
│  ├─ TreasuryGuardService  Policy, compliance, bootstrap  │
│  ├─ WorkspaceService   Passkey wallets, sessions, assets │
│  └─ CommerceService    Payment links, claims, invoices   │
├──────────────────────────────────────────────────────────┤
│  Storage                                                 │
│  ├─ Prisma 7 + PostgreSQL (Neon)  Profiles, sessions     │
│  └─ DemoStore (JSON file)         Treasury state          │
├──────────────────────────────────────────────────────────┤
│  Solana devnet         On-chain wallets, SPL tokens       │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer          | Technology                                           |
| -------------- | ---------------------------------------------------- |
| Frontend       | Next.js 16, React 19, Tailwind CSS v4                |
| Backend        | Express 4, tsx (dev), Node.js                        |
| Database       | Prisma 7.5, `@prisma/adapter-pg`, PostgreSQL (Neon)  |
| Blockchain     | Solana devnet, `@solana/web3.js`, `@solana/spl-token`|
| Auth           | WebAuthn passkeys (local + Veridex cross-origin SDK) |
| Payments       | x402 protocol, `@veridex/agentic-payments`           |

## Prerequisites

- **Node.js** 20+
- **Bun** (package manager)
- **PostgreSQL** — Neon serverless recommended (connection string in `.env`)
- **Solana CLI** — optional, for manual devnet interaction

## Setup

```bash
# Clone and enter the app directory
cd hackathon/stablehacks-2026/app

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and other config (see below)

# Generate Prisma client and push schema
bun run prisma:generate
bun run prisma:push

# Start dev (runs Next.js + Express concurrently)
bun run dev
```

## Environment Variables

| Variable                                        | Required | Description                                      |
| ----------------------------------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`                                  | Yes      | PostgreSQL connection string (Neon pooler)        |
| `SOLANA_RPC_URL`                                | No       | Defaults to `https://api.devnet.solana.com`       |
| `VERIDEX_RELAYER_API_URL`                       | No       | Veridex relayer for cross-origin auth             |
| `NEXT_PUBLIC_VERIDEX_AUTH_PORTAL_URL`           | No       | Auth portal URL for passkey registration          |
| `NEXT_PUBLIC_ENABLE_PORTAL_PASSKEY_REGISTRATION`| No       | Enable portal-based passkey registration          |
| `NEXT_PUBLIC_ENABLE_PORTAL_PASSKEY_AUTHENTICATION`| No    | Enable portal-based passkey authentication        |

## Scripts

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `bun run dev`         | Start Next.js + Express in dev mode              |
| `bun run build`       | Production build (Next.js webpack)               |
| `bun run start`       | Start production server                          |
| `bun run prisma:generate` | Regenerate Prisma client                    |
| `bun run prisma:push` | Push schema to database                          |
| `bun run check:resources` | Validate external resource dependencies     |

## Dashboard Pages

| Route                      | Description                                   |
| -------------------------- | --------------------------------------------- |
| `/dashboard`               | Overview — wallet, treasury status, funding    |
| `/dashboard/collections`   | Payment links, payout claims, invoices         |
| `/dashboard/reviews`       | Payout queue — submit, approve, reject         |
| `/dashboard/counterparties`| Registry with KYC status and risk controls     |
| `/dashboard/logs`          | Audit ledger and dependency health             |
| `/dashboard/policy`        | Treasury rules, thresholds, allowed assets     |
| `/dashboard/settings`      | Workspace config, wallet details, session info |

## Express API Endpoints

| Method | Path                                  | Description                       |
| ------ | ------------------------------------- | --------------------------------- |
| GET    | `/api/state`                          | Full dashboard state              |
| POST   | `/api/workspace/connect`              | Connect passkey wallet            |
| GET    | `/api/workspace/:id`                  | Get workspace state               |
| POST   | `/api/workspace/:id/airdrop`          | Request devnet SOL airdrop        |
| POST   | `/api/workspace/:id/seed-stablecoin`  | Seed stablecoin liquidity         |
| POST   | `/api/workspace/:id/payment-links`    | Create payment link               |
| POST   | `/api/workspace/:id/claim-links`      | Create payout claim link          |
| POST   | `/api/workspace/:id/invoices`         | Create invoice                    |
| GET    | `/api/public/links/:slug`             | Public link state                 |
| POST   | `/api/public/links/:slug/pay`         | Verify payment                    |
| POST   | `/api/public/links/:slug/claim`       | Claim payout                      |
| POST   | `/api/bootstrap`                      | Bootstrap treasury                |
| POST   | `/api/counterparties`                 | Register counterparty             |
| POST   | `/api/payouts`                        | Submit payout                     |
| POST   | `/api/payouts/:id/approve`            | Approve payout                    |
| POST   | `/api/payouts/:id/reject`             | Reject payout                     |
| GET    | `/api/health`                         | Health check                      |
| GET    | `/api/export`                         | Export audit log (JSON/CSV)       |

---

## SIX Group Market Data Integration

The hackathon provides access to **SIX Group financial market data APIs** via mTLS certificates. This enables Settla to display live market prices, forex rates, and instrument metadata alongside Solana treasury operations.

### Credentials

The `CH56655-api2026hack32/` folder contains mTLS certificates:

```
CH56655-api2026hack32/
├── signed-certificate.pem    # Client certificate (signed by SIX CA)
├── private-key.pem           # Private key
├── CSR.pem                   # Certificate signing request
├── certificate.p12           # PKCS#12 bundle (cert + key)
└── password.txt              # P12 password
```

> **Security**: Never commit these to version control. Add `CH56655-api2026hack32/` to `.gitignore`.

### Available APIs

| API                   | Base URL                                                     | Description                        |
| --------------------- | ------------------------------------------------------------ | ---------------------------------- |
| Free Text Search      | `https://api.six-group.com/web/v2/search/freeTextSearch/...` | Search instruments by name/ticker  |
| Instrument Base       | `https://api.six-group.com/web/v2/instruments/referenceData/...` | Instrument reference data      |
| Instrument Markets    | `https://api.six-group.com/web/v2/instruments/referenceData/instrumentMarkets` | Market listings, BC codes |
| Intraday Snapshot     | `https://api.six-group.com/web/v2/listings/marketData/intradaySnapshot` | Real-time/delayed prices    |
| Streaming Market Data | WebSocket endpoint                                           | Real-time streaming prices         |

### Entitled Instruments

| Market                          | BC Code | Sample VALORs                                 |
| ------------------------------- | ------- | --------------------------------------------- |
| NYSE                            | 65      | 114621 (KO), 138405792 (BLK), 959184 (ORCL)  |
| NASDAQ (End-of-Day)             | 67      | 908440 (AAPL), 951692 (MSFT), 984101 (WMT)   |
| Cross currency / precious metals| 148     | 946681 (EUR/USD), 275164 (CHF/USD)            |
| NASDAQ Copenhagen (End-of-Day)  | 12      | 129508879 (Novo Nordisk), 1150721 (Danske)    |

The source material for the integration lives one level above the app:

- [`../Hackathon Documentation 2026.pdf`](../Hackathon%20Documentation%202026.pdf)
- [`../Cross Currency and Precious Metals Identifiers.xlsx`](../Cross%20Currency%20and%20Precious%20Metals%20Identifiers.xlsx)
- [`./CH56655-api2026hack32/`](./CH56655-api2026hack32)

The spreadsheet contains the usable `VALOR_BC` identifiers for the hackathon account. The current code uses identifiers derived from worksheet `BC148`, including:

- `EUR/USD` -> `946681_148`
- `CHF/USD` -> `275164_148`
- `CHF/EUR` -> `968880_148`
- `GBP/USD` -> `275017_148`
- `USD/NGN` -> `199113_148`
- `USD/XAG` -> `274720_148`
- `USD/XPT` -> `287635_148`
- `USD/XPD` -> `283501_148`

### Integration Plan

The SIX APIs plug into Settla as a **market data oracle** — providing live forex rates for cross-border payment pricing and instrument data for treasury asset valuation.

#### 1. SIX API Client (`src/server/services/SixMarketDataService.ts`)

The working Node integration should use a true TLS client certificate transport, not `fetch(..., { agent })`. This app now prefers the provided PKCS#12 bundle and falls back to PEM only if needed:

```typescript
import fs from 'node:fs';
import https from 'node:https';

const pfx = fs.readFileSync('CH56655-api2026hack32/certificate.p12');
const passphrase = fs.readFileSync('CH56655-api2026hack32/password.txt', 'utf8').trim();

const agent = new https.Agent({ pfx, passphrase, rejectUnauthorized: true, keepAlive: true });

async function getIntradaySnapshot(valorBc: string) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.six-group.com/web/v2/listings/marketData/intradaySnapshot?scheme=VALOR_BC&ids=${valorBc}&preferredLanguage=EN`,
      { method: 'GET', agent, headers: { Accept: 'application/json' } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
      },
    );
    req.on('error', reject);
    req.end();
  });
}
```

**Key design decisions:**
- Prefer `certificate.p12` + `password.txt`, because that is the packaged client identity delivered for the hackathon account
- Use `https.request` for the SIX calls so the client certificate is definitely presented during the TLS handshake
- Cache responses (SIX rate limits are aggressive) — 60s TTL for intraday, 5m for reference data
- Keep the PEM paths available as a fallback for debugging

#### 2. Forex Rate Endpoint (`/api/market-data/forex`)

Current Next route:

```
GET /api/market-data/forex -> fetch the configured cross-currency / precious-metals basket
```

Suggested extensions:

```
GET /api/market-data/forex/:pair          → Live forex rate (e.g., EUR/USD)
GET /api/market-data/instruments/:valor   → Instrument reference data
GET /api/market-data/snapshot/:valorBc    → Intraday price snapshot
```

#### 3. Dashboard Integration Points

| Feature                          | Where                      | SIX API Used              |
| -------------------------------- | -------------------------- | ------------------------- |
| Cross-border payment FX display  | `/pay/[id]`, `/claim/[id]` | Forex rates (BC=149)      |
| Treasury asset valuation         | `/dashboard` overview      | Intraday snapshot         |
| Counterparty corridor pricing    | `/dashboard/counterparties`| Forex + instrument search |
| Payment link USD equivalent      | `/dashboard/collections`   | Forex rates               |

#### 4. Configuration

Add to `.env`:

```env
# SIX Group Market Data API (mTLS)
SIX_API_PFX_PATH=CH56655-api2026hack32/certificate.p12
SIX_API_PFX_PASSWORD_PATH=CH56655-api2026hack32/password.txt
SIX_API_CERT_PATH=CH56655-api2026hack32/signed-certificate.pem
SIX_API_KEY_PATH=CH56655-api2026hack32/private-key.pem
SIX_API_BASE_URL=https://api.six-group.com/web/v2
```

`SIX_API_PFX_PATH` is the preferred path in this codebase. PEM values remain useful as a fallback.

#### 5. Runtime Registration

Add `SixMarketDataService` to the server runtime alongside existing services:

```typescript
// src/server/runtime.ts
interface StablehacksRuntime {
  solana: SolanaService;
  treasuryGuard: TreasuryGuardService;
  workspaceService: WorkspaceService;
  commerceService: CommerceService;
  marketData: SixMarketDataService;  // ← new
  store: DemoStore;
}
```

### Implementation Priority

1. **SixMarketDataService** — mTLS client, response caching, error handling
2. **Express routes** — `/api/market-data/*` endpoints
3. **Forex widget** — Dashboard component showing live EUR/USD, CHF/USD rates
4. **Payment link pricing** — Show USD equivalent on payment/claim pages
5. **Streaming** — WebSocket client for real-time price updates (stretch goal)

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   ├── globals.css               # Tailwind + design tokens
│   ├── actions.ts                # Server actions
│   ├── lib/server-data.ts        # Server-side data fetchers
│   ├── api/auth/                 # Auth relay API routes
│   ├── auth/                     # Auth pages (passkey flows)
│   ├── dashboard/                # Dashboard pages
│   │   ├── layout.tsx            # Sidebar navigation
│   │   ├── page.tsx              # Overview
│   │   ├── collections/          # Payment links, claims, invoices
│   │   ├── reviews/              # Payout queue
│   │   ├── counterparties/       # Registry
│   │   ├── logs/                 # Audit log
│   │   ├── policy/               # Treasury policy
│   │   └── settings/             # Workspace settings
│   ├── pay/[id]/                 # Public payment page
│   └── claim/[id]/               # Public claim page
├── components/
│   ├── dashboard/                # Dashboard UI primitives
│   ├── landing/                  # Landing page sections
│   └── layout/                   # Navbar, Footer
├── lib/
│   ├── local-passkey-wallet.ts   # Local WebAuthn passkey ops
│   └── veridex-auth.ts           # Veridex SDK helpers
└── server/
    ├── index.ts                  # Express server entrypoint
    ├── runtime.ts                # Service singleton registry
    ├── db.ts                     # Prisma client (PrismaPg + pg Pool)
    ├── services/                 # Business logic services
    ├── store/                    # DemoStore (JSON persistence)
    └── types/                    # TypeScript type definitions
```

## License

Built for the StableHacks 2026 hackathon.
