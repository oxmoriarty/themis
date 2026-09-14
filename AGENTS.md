# Themis agent instructions

## Current project state

This repository is at the end of Phase Zero. There is no application or contract implementation yet. Read [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), `BUILD_SPEC.md`, `AGENT_TANK_RULES.md`, and every file in `docs-source/genlayer-docs/` before changing product, contract, network, wallet, or deployment behavior. Treat the supplied GenLayer documentation as the source of truth; do not substitute remembered SDK APIs or online examples without reconciling them to the supplied material.

`docs-source/branding/themisLogoBlack.png` and `docs-source/branding/themisLogoWhite.png` are the official logo variants. Preserve their aspect ratio and colors; use black on light surfaces and white on dark surfaces.

## Non-negotiable GenLayer rules

- The remote target is **Studio Next**, not Bradbury: RPC `https://studio-next.genlayer.com/api`, chain ID `61997`, explorer `https://explorer-studio-dev.genlayer.com/`.
- The general documentation also names a different “Studionet” endpoint/chain and SDK chain alias. Do not guess that the alias maps to Studio Next. Complete the compatibility probe documented in the implementation plan and require `eth_chainId == 61997` before enabling a deployment or wallet write.
- Required project release line: `genlayer-js@2.0.0-rc.1`, `@genlayer/transaction-kit@0.1.0-rc.2`, and the matching React adapter at `0.1.0-rc.2`. The source does not specify the adapter package name; verify it first. Do not silently upgrade/downgrade these prereleases.
- Every generated single-file Intelligent Contract must begin on its literal first line with:

  ```python
  # { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
  ```

  Never use `py-genlayer:test`, `py-genlayer:latest`, or an unversioned runner.
- Use the validated installed SDK syntax only. The bundled aggregate reference contains conflicting-looking examples around contract decorators and sender accessors; run `genvm-lint check --json` and direct tests rather than mixing variants.
- Use storage-safe GenLayer types (`TreeMap`, `DynArray`, typed dataclasses, `Address`, `u256` for GEN), not Python `dict`/`list` for persisted state, floats for value, or unsupported imports.
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

Before merging a contract change: lint it, run direct tests with LLM/web mocks, exercise validator disagreement, then integration tests. Direct tests run leader logic and are not consensus proof. Before declaring a deployed flow successful: check Studio Next chain ID, receipt execution result, schema/code, deployed address, and final transaction state.

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
