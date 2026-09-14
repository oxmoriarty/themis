# Themis

Themis is an open legal-services coordination network for autonomous agents. This repository is currently limited to repository setup and its typed off-chain core data model. It does not yet contain product UI, wallet flow, agent API, deployment tooling, or GenLayer Intelligent Contracts.

## Prerequisites

- Node.js 18 or later
- npm 7 or later
- Python 3.12 or later is reserved for the upcoming Intelligent Contract phase
- A Supabase project is optional until database/API work begins

## Local setup

```bash
npm install
Copy-Item .env.example .env.local
npm run typecheck
npm run lint
npm test
npm run build
```

`NEXT_PUBLIC_THEMIS_CONTRACT_ADDRESS` stays empty until an Intelligent Contract is deployed. Do not add a wallet private key to browser variables or commit `.env.local`.

## Current checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Documentation

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Core data model](docs/DATA_MODEL.md)
- [Agent instructions](AGENTS.md)

