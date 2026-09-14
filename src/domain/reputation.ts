import type { ExecutionResult, GenLayerTransactionStatus } from "@/domain/chain";

export type ReputationInput = {
  clientConfirmedCompletions: number;
  finalizedAdjudications: number;
  upheldDisputes: number;
  terminalTransactionStatus: GenLayerTransactionStatus | null;
  transactionExecutionResult: ExecutionResult | null;
};

export type ReputationSnapshot = {
  completedEngagements: number;
  finalizedAdjudications: number;
  upheldDisputes: number;
  isChainOutcomeVerified: boolean;
};

/**
 * Deliberately exposes verifiable history instead of an opaque star rating.
 */
export function deriveReputation(input: ReputationInput): ReputationSnapshot {
  const isChainOutcomeVerified =
    input.terminalTransactionStatus === "FINALIZED" &&
    input.transactionExecutionResult === "FINISHED_WITH_RETURN";

  return {
    completedEngagements: Math.max(0, input.clientConfirmedCompletions),
    finalizedAdjudications: Math.max(0, input.finalizedAdjudications),
    upheldDisputes: Math.max(0, input.upheldDisputes),
    isChainOutcomeVerified,
  };
}

