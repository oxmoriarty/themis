# Themis agent instructions

## Current project state

Phase Zero, repository/data-model work, the typed GenLayerJS client wrapper, and a target-schema-validated Intelligent Contract are complete. Its direct test suite exists, but must be rerun after the 2026-09-16 runner/API migration: the current Windows `gltest` harness fails during its own tempfile setup before contract execution. The application UI, wallet UI, deployment/indexing layer, remote integration suite, and Studio Next deployment are not complete. Read [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), `BUILD_SPEC.md`, `AGENT_TANK_RULES.md`, and every file in `docs-source/genlayer-docs/` before changing product, contract, network, wallet, or deployment behavior. Treat the supplied GenLayer documentation as the source of truth; reconcile later official release guidance against it rather than substituting remembered APIs.

`docs-source/branding/themisLogoBlack.png` and `docs-source/branding/themisLogoWhite.png` are the official logo variants. Preserve their aspect ratio and colors; use black on light surfaces and white on dark surfaces.

## Non-negotiable GenLayer rules

- The remote target is **Studio Next**, not Bradbury: RPC `https://studio-next.genlayer.com/api`, chain ID `61997`, explorer `https://explorer-studio-dev.genlayer.com/`.
- `studionet` is the stable Studio identity and must never be pointed at Studio Next. The installed v0.6 RC exposes `studioDevnet` (chain `61997`) but its built-in RPC is `https://studio-dev.genlayer.com/api`; use the official v2-dev boilerplate pattern: extend that definition as one shared chain object while overriding its RPC/name/native currency to the required Studio Next values. Require `eth_chainId == 61997` from both RPC and wallet before enabling a deployment or wallet write.
- Required, lockfile-pinned project release line: `genlayer-js@2.0.0-rc.1`, `@genlayer/transaction-kit@0.1.0-rc.2`, and `@genlayer/transaction-kit-react@0.1.0-rc.2`. These are exact pins, not ranges. Do not silently upgrade/downgrade them.
- Studio Next is fee-aware. Before any deploy or live write, run representative fee-profile tests for every materially expensive/message-emitting branch, commit the generated profile, request a current SDK/Transaction Kit estimate, and submit its `distribution` and `feeValue` unchanged. Never hand-build fee arithmetic or call Studio Next gasless based on its name; detect a gasless estimate at runtime. Show the deposit, consumed amount, and finalized refund as distinct values.
- Every generated single-file Intelligent Contract must begin on its literal first line with:

  ```python
  # { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
  ```

  Never use `py-genlayer:test`, `py-genlayer:latest`, an unversioned runner, or the retired `1jb45…`/`9b8…` runner hashes. The `5jyc…` pin and the current contract schema were confirmed by the Studio schema endpoint for chain `61997` on 2026-09-16. This is a schema-compatibility gate, not a Studio Next deployment or execution result.
- Use the target-verified runner/API syntax only: `import genlayer as gl`, `gl.contract.Contract`, `gl.storage.TreeMap`, typed `gl.Address`/`gl.u64`, and `from genlayer.storage import allow as allow_storage`. The supplied aggregate reference contains older incompatible examples; run `genvm-lint check --json` and direct tests rather than mixing variants.
- Use storage-safe GenLayer types (`TreeMap`, `DynArray`, typed dataclasses, `Address`, `u256` for GEN), not Python `dict`/`list` for persisted state, floats for value, or unsupported imports.
- Allocate generic storage types in constructors with `gl.storage.inmem_allocate(FullySpecializedType)`; never instantiate `TreeMap` or `DynArray` with `()`.
- Deterministic logic stays outside nondeterministic blocks. LLM/web work belongs inside an equivalence-principle pattern.
- Never use `strict_eq` for an LLM decision. A schema-only validator is an insecure anti-pattern. For Themis adjudication, validators must independently recompute and substantively compare the closed decision.
- Treat `gl.vm.Return`, `gl.vm.UserError`, and `gl.vm.VMError` explicitly before accessing result data. Malformed/unknown LLM outcomes should not become success.
- A transaction hash, `ACCEPTED`, and `FINALIZED` do not prove execution. Verify the receipt execution result before state reads, success UI, reputation updates, payment, or deployment claims.
- Use separate names/types for Themis matter states and GenLayer transaction states. Until Studio Next proves otherwise, use only the supplied GenLayerJS enum states; do not invent a `LEADER_REVEALING` state from the narrative lifecycle or assume an OutOfFee response. Do not present `ACCEPTED` as permanent; it remains appealable. Do not emit financial/external consequences at `on='accepted'`; use `on='finalized'` and idempotency.
- Do not deploy or test the final flow on Bradbury. Localnet/GLSim are for development; Studio Next is the remote release gate.

## Architecture and privacy rules

- Keep GenLayer meaningful: it owns the consensus-critical written-obligation decision and associated verifiable transition. It is not a storage hash or generic chatbot.
- The MVP’s GenLayer evidence lane is deliberately public-to-validators, bounded plain text only. Warn the user before promotion. Private Supabase files, signed URLs, and server-only documents must not be claimed as inputs to validator consensus. Copy any contract-staged evidence into memory with `gl.storage.copy_to_memory` before a nondeterministic function; GenVM storage is inaccessible inside those functions.
- Keep original evidence in private Supabase Storage; hash original bytes with SHA-256, preserve metadata/provenance, validate file size/type/signature, and distinguish originals from derived extraction. Never make confidential case files public for convenience.
- Supabase RLS defaults to deny. Enforce matter membership and role authorization server-side too. Keep the service role key server-only.
- Wallet address ownership requires a server-verified, one-time, expiring signature challenge; never trust a request body’s wallet address. Never ask for, store, log, or expose private keys.
- The machine API may create authenticated off-chain drafts and return typed transaction instructions. It must not pretend to custody an external agent’s wallet or claim an unimplemented A2A integration.
- Do not use paid inference APIs. Core adjudication uses GenLayer-supported contract inference only.
- Do not show fake providers, payments, transactions, completions, earnings, or reputation. Demo seed services must be prominently labelled and separate from on-chain state.

## Required quality gates

Before merging a contract change: lint it, run direct tests with LLM/web mocks, exercise validator disagreement, then integration tests. Direct tests run leader logic and are not consensus proof. Before deployment, generate a current fee profile; regenerate it whenever contract code, GenVM/Studio, or fee policy changes. Before declaring a deployed flow successful: check Studio Next chain ID, receipt execution result (`FINISHED_WITH_RETURN` via the SDK `isSuccessful` helper or Transaction Kit normalized outcome), schema/code, deployed address, and final transaction state.

Before calling any product phase complete: run strict type checking, lint, relevant unit/API/component tests, contract tests, production build, a wallet/network smoke test, dependency/security review, and record real results in `docs/FINAL_VERIFICATION.md`. Do not claim a command, deployment, payment, or test was run when it was not.

## Product/UI boundaries

Use “legal service agent” and describe Themis as prototype coordination/adjudication infrastructure. Do not claim legal advice, legal representation, attorney verification, legal bindingness, or universal jurisdictional validity.

Build a calm, premium, accessible, responsive interface with the design tokens in the implementation plan, an 8-point spacing rhythm, clear focus/loading/error/empty/pending states, and Lucide (or equivalent accessible) icons. Avoid generic AI copy, neon gradients, crypto imagery, and arbitrary status strings.

## Safe implementation sequence

1. Resolve and document the Studio Next SDK/Transaction Kit compatibility probe.
2. Add environment documentation, migrations/RLS, storage/auth validation.
3. Build one minimal matter/registry/adjudication contract with tests.
4. Add deployment/indexing/client wrappers and validate Studio Next. Do not assume the documented `studionet` `gltest` configuration or GenLayerJS chain alias targets Studio Next.
5. Add the machine API/SDK, then frontend flows.
6. Add payment only after the target-network transfer probe passes; otherwise label it unavailable.
7. Finish security, accessibility, integration, and verification documentation.

Keep commits focused, preserve unrelated user changes, avoid secrets, and document a real limitation rather than inventing behavior.
