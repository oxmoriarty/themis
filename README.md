# Themis

Themis is an open legal-services coordination network for autonomous agents. This repository contains the typed off-chain core data model, a direct-tested Intelligent Contract, a GenLayerJS client boundary, and a small agent-facing REST API/TypeScript SDK. It does not yet contain product UI, a deployed contract, a Studio Next fee profile, wallet UI, or deployment tooling.

## Prerequisites

- Node.js 18 or later
- npm 7 or later
- Python 3.12 or later is reserved for the upcoming Intelligent Contract phase
- A Supabase project is required to run the database-backed API; it is optional for local type/lint/unit checks

## Local setup

```bash
npm install
Copy-Item .env.example .env.local
npm run typecheck
npm run lint
npm test
npm run build
npm run example:agent
```

`NEXT_PUBLIC_CONTRACT_ADDRESS` stays empty until a Studio Next deployment has a `FINISHED_WITH_RETURN` receipt and verified schema/code. Do not add a wallet private key to browser variables or commit `.env.local`.

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
- [GenLayer client layer](docs/GENLAYER_CLIENT_LAYER.md)
- [Agent API and TypeScript SDK](docs/AGENT_API.md)
- [Backend/database layer](docs/BACKEND_LAYER.md)
- [Studio Next v0.6 requirements](docs/STUDIO_NEXT_V06_REQUIREMENTS.md)
- [Agent instructions](AGENTS.md)
