import { createClient } from "genlayer-js";
import { ExecutionResult, type CalldataEncodable, type FeesDistributionInput, type Hash, type TransactionFeeOptions } from "genlayer-js/types";

import { executionResultSchema, genLayerTransactionStatusSchema, hasSuccessfulExecution, type ExecutionResult as ThemisExecutionResult, type GenLayerTransactionStatus } from "@/domain/chain";
import { transactionHashSchema, walletAddressSchema, type TransactionHash, type WalletAddress } from "@/domain/identifiers";
import { createStudioNextNetwork, STUDIO_NEXT_CHAIN_ID_HEX, STUDIO_NEXT_EXPLORER_URL, STUDIO_NEXT_RPC_URL, ThemisNetworkError, type StudioNextEnvironment } from "@/lib/genlayer/network";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface ThemisFeeQuote {
  distribution: FeesDistributionInput;
  feeValue: bigint;
}

export interface ContractReadRequest {
  functionName: "get_matter_state" | "get_matter_decision" | "get_evidence_count" | "get_service_owner" | "get_service_metadata_hash";
  args: readonly CalldataEncodable[];
}

export interface ContractWriteRequest {
  functionName: "register_service" | "update_service" | "deactivate_service" | "create_matter" | "accept_matter" | "open_evidence" | "append_consensus_evidence" | "start_service" | "request_completion" | "confirm_completion" | "open_dispute" | "begin_adjudication" | "adjudicate_dispute" | "cancel_matter";
  args: readonly CalldataEncodable[];
  /** A current SDK/Transaction Kit estimate, never hand-built arithmetic. */
  fees: ThemisFeeQuote;
  value?: bigint;
}

export interface SubmittedThemisTransaction {
  hash: TransactionHash;
  /** A submission is never presented as a completed transaction. */
  stage: "SUBMITTED";
  explorerUrl: string;
}

export interface ThemisTransactionSnapshot {
  hash: TransactionHash;
  status: GenLayerTransactionStatus;
  executionResult: ThemisExecutionResult | null;
  decisionReached: boolean;
  finalized: boolean;
  finalizedSuccessfully: boolean;
  explorerUrl: string;
  rawReceipt: unknown;
}

export interface WalletConnection {
  address: WalletAddress;
  chainId: string;
}

type ReceiptLike = { status?: unknown; statusName?: unknown; txExecutionResultName?: unknown; tx_execution_result_name?: unknown };

export interface GenLayerOperations {
  readContract(input: { address: WalletAddress; functionName: string; args: readonly CalldataEncodable[] }): Promise<unknown>;
  writeContract(input: { address: WalletAddress; functionName: string; args: readonly CalldataEncodable[]; value: bigint; fees: ThemisFeeQuote }): Promise<`0x${string}`>;
  waitForDecision(input: { hash: TransactionHash; fullTransaction: boolean }): Promise<ReceiptLike>;
  waitForFinalization(input: { hash: TransactionHash; fullTransaction: boolean }): Promise<ReceiptLike>;
}

export class ThemisClientError extends Error {
  constructor(
    public readonly code: "CONTRACT_NOT_CONFIGURED" | "FEE_QUOTE_REQUIRED" | "UNKNOWN_TRANSACTION_STATUS" | "UNKNOWN_EXECUTION_RESULT" | "EXECUTION_FAILED" | "NOT_FINALIZED",
    message: string,
  ) {
    super(message);
    this.name = "ThemisClientError";
  }
}

function contractAddressFromEnvironment(value: string | undefined): WalletAddress {
  const parsed = walletAddressSchema.safeParse(value);
  if (!parsed.success) throw new ThemisClientError("CONTRACT_NOT_CONFIGURED", "NEXT_PUBLIC_CONTRACT_ADDRESS must be a deployed 20-byte Studio Next contract address.");
  return parsed.data;
}

function normalizeReceipt(hash: TransactionHash, receipt: ReceiptLike): ThemisTransactionSnapshot {
  const status = genLayerTransactionStatusSchema.safeParse(receipt.statusName ?? receipt.status);
  if (!status.success) throw new ThemisClientError("UNKNOWN_TRANSACTION_STATUS", `Unknown GenLayer transaction status: ${String(receipt.statusName ?? receipt.status)}.`);

  const rawExecution = receipt.txExecutionResultName ?? receipt.tx_execution_result_name;
  const execution = rawExecution === undefined || rawExecution === null ? null : executionResultSchema.safeParse(rawExecution);
  if (execution !== null && !execution.success) throw new ThemisClientError("UNKNOWN_EXECUTION_RESULT", `Unknown GenLayer execution result: ${String(rawExecution)}.`);

  const finalized = status.data === "FINALIZED";
  const executionResult = execution === null ? null : execution.data;
  return {
    hash,
    status: status.data,
    executionResult,
    decisionReached: status.data === "ACCEPTED" || finalized,
    finalized,
    finalizedSuccessfully: hasSuccessfulExecution({ status: status.data, executionResult }),
    explorerUrl: `${STUDIO_NEXT_EXPLORER_URL}tx/${hash}`,
    rawReceipt: receipt,
  };
}

/** Keeps submission, a consensus decision, and final irreversible success separate. */
export class ThemisGenLayerClient {
  constructor(private readonly operations: GenLayerOperations, private readonly contractAddress: WalletAddress) {}

  async read(request: ContractReadRequest): Promise<unknown> {
    return this.operations.readContract({ address: this.contractAddress, functionName: request.functionName, args: request.args });
  }

  async submit(request: ContractWriteRequest): Promise<SubmittedThemisTransaction> {
    if (!request.fees || request.fees.feeValue < 0n) throw new ThemisClientError("FEE_QUOTE_REQUIRED", "A current Studio Next fee quote is required before writing.");
    const hash = transactionHashSchema.parse(await this.operations.writeContract({
      address: this.contractAddress,
      functionName: request.functionName,
      args: request.args,
      value: request.value ?? 0n,
      fees: request.fees,
    }));
    return { hash, stage: "SUBMITTED", explorerUrl: `${STUDIO_NEXT_EXPLORER_URL}tx/${hash}` };
  }

  async waitForDecision(hash: TransactionHash): Promise<ThemisTransactionSnapshot> {
    const validatedHash = transactionHashSchema.parse(hash);
    return normalizeReceipt(validatedHash, await this.operations.waitForDecision({ hash: validatedHash, fullTransaction: false }));
  }

  async waitForFinalization(hash: TransactionHash): Promise<ThemisTransactionSnapshot> {
    const validatedHash = transactionHashSchema.parse(hash);
    return normalizeReceipt(validatedHash, await this.operations.waitForFinalization({ hash: validatedHash, fullTransaction: false }));
  }

  /** Throws before post-write reads, reputation, payment, or a success UI. */
  requireFinalizedSuccess(snapshot: ThemisTransactionSnapshot): void {
    if (!snapshot.finalized) throw new ThemisClientError("NOT_FINALIZED", "The transaction has a decision but is still appealable.");
    if (snapshot.executionResult !== ExecutionResult.FINISHED_WITH_RETURN) throw new ThemisClientError("EXECUTION_FAILED", "The finalized transaction did not execute with a return value.");
  }
}

function createOperations(provider: Eip1193Provider | undefined, account: WalletAddress | undefined, environment: StudioNextEnvironment): GenLayerOperations {
  const client = createClient({
    chain: createStudioNextNetwork(environment),
    ...(account ? { account: account as `0x${string}` } : {}),
    ...(provider ? { provider } : {}),
  });
  return {
    readContract: (input) => client.readContract({ ...input, address: input.address as `0x${string}`, args: [...input.args] }),
    writeContract: (input) => client.writeContract({
      ...input,
      address: input.address as `0x${string}`,
      args: [...input.args],
      fees: input.fees as TransactionFeeOptions,
    }),
    // transactionHashSchema validates the 0x + 64-hex runtime invariant before this SDK brand cast.
    waitForDecision: (input) => client.waitForDecision({ ...input, hash: input.hash as Hash }),
    waitForFinalization: (input) => client.waitForFinalization({ ...input, hash: input.hash as Hash }),
  };
}

export function createThemisReadClient(environment: StudioNextEnvironment = {}): ThemisGenLayerClient {
  return new ThemisGenLayerClient(createOperations(undefined, undefined, environment), contractAddressFromEnvironment(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS));
}

export function createThemisWriteClient(provider: Eip1193Provider, account: WalletAddress, environment: StudioNextEnvironment = {}): ThemisGenLayerClient {
  return new ThemisGenLayerClient(createOperations(provider, account, environment), contractAddressFromEnvironment(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS));
}

export async function connectStudioNextWallet(provider: Eip1193Provider): Promise<WalletConnection> {
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new ThemisNetworkError("WALLET_UNAVAILABLE", "The wallet did not provide an account.");
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId !== STUDIO_NEXT_CHAIN_ID_HEX) throw new ThemisNetworkError("WRONG_NETWORK", "Switch the wallet to Studio Next before submitting a transaction.");
  return { address: walletAddressSchema.parse(accounts[0]), chainId };
}

/** Explicit, user-initiated network switch; no automatic wallet mutation. */
export async function switchWalletToStudioNext(provider: Eip1193Provider): Promise<void> {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: STUDIO_NEXT_CHAIN_ID_HEX }] });
  } catch (error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
    if (code !== 4902) throw new ThemisNetworkError("WALLET_REJECTED", "The wallet did not switch to Studio Next.");
    await provider.request({ method: "wallet_addEthereumChain", params: [{
      chainId: STUDIO_NEXT_CHAIN_ID_HEX,
      chainName: "GenLayer Studio Next",
      nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
      rpcUrls: [STUDIO_NEXT_RPC_URL],
      blockExplorerUrls: [STUDIO_NEXT_EXPLORER_URL],
    }] });
  }
}
