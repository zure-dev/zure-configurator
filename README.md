# Zure Configurator

A Shopify Plus-compatible embedded app and storefront configurator platform for complex configurable products.

## Architecture

- **Backend:** Next.js 14 + TypeScript + PostgreSQL + Prisma
- **Rule Engine:** Pure TypeScript package (`packages/rule-engine`) — zero dependencies, deterministic
- **Storefront Widget:** Preact Web Component with Shadow DOM isolation
- **Admin UI:** Shopify Polaris embedded app
- **Theme Integration:** Theme App Extension (app block)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Shopify Partner account + development store

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env
# Edit .env with your database URL and Shopify credentials

# 3. Create database and run migrations
npx prisma migrate dev

# 4. Seed the database with Zure vanity data
npm run db:seed

# 5. Start the development server
npm run dev
```

### Widget Development

```bash
# Build the storefront widget (outputs to extensions/configurator-widget/assets/)
npm run widget:build

# Watch mode for widget development
npm run widget:dev
```

### Testing

```bash
# Run all tests
npm test

# Run rule engine tests only
cd packages/rule-engine && npm test

# Watch mode
npm run test:watch

# E2E tests (requires running dev server + test store)
npm run test:e2e
```

### Deploy to Shopify

```bash
# Deploy app and theme extension
npm run shopify:deploy
```

## Project Structure

```
zure-configurator/
├── packages/rule-engine/    # Pure TypeScript rule engine
├── src/
│   ├── app/                 # Next.js routes (API + Admin UI)
│   ├── lib/                 # Core utilities (db, auth, webhooks)
│   └── services/            # Business logic services
├── widget/                  # Preact storefront widget (pre-build)
├── extensions/              # Shopify Theme App Extension
├── prisma/                  # Database schema + seeds
├── scripts/                 # Migration and utility scripts
└── tests/                   # Integration + E2E tests
```

## Key Design Decisions

1. **Single cart line item** — one parent SKU with detailed properties, component mapping stored in app DB
2. **Priority-based media cascade** — family default → finish → basin/top → exact match
3. **Customer-tag trade pricing** — `trade` tag triggers alternate price table
4. **All rules in app DB** — no Shopify metaobject mirroring in Phase 1
5. **Component inventory schema-ready** — tables exist but tracking mode is `NONE` until Phase 2
