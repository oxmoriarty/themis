import { z } from "zod";

import { transactionHashSchema } from "@/domain/identifiers";

/**
 * These are the only statuses exposed by the supplied GenLayerJS
 * TransactionStatus enum. Protocol prose also mentions leader-revealing and
 * OutOfFee, but neither is added here without a verified Studio Next API.
 */
export const genLayerTransactionStatusValues = [
  "PENDING",
  "CANCELED",
  "PROPOSING",
  "COMMITTING",
  "REVEALING",
  "ACCEPTED",
  "FINALIZED",
  "UNDETERMINED",
] as const;

export const genLayerTransactionStatusSchema = z.enum(genLayerTransactionStatusValues);
export type GenLayerTransactionStatus = z.infer<typeof genLayerTransactionStatusSchema>;

export const executionResultValues = [
  "FINISHED_WITH_RETURN",
  "FINISHED_WITH_ERROR",
  "NOT_VOTED",
] as const;

export const executionResultSchema = z.enum(executionResultValues);
export type ExecutionResult = z.infer<typeof executionResultSchema>;

export const chainTransactionSchema = z.object({
  hash: transactionHashSchema,
  status: genLayerTransactionStatusSchema,
  executionResult: executionResultSchema.nullable(),
  contractAddress: z.string().nullable(),
  action: z.string().min(1).max(64),
  matterId: z.string().uuid().nullable(),
  observedAt: z.coerce.date(),
});

export type ChainTransaction = z.infer<typeof chainTransactionSchema>;

export function hasSuccessfulExecution(transaction: Pick<ChainTransaction, "status" | "executionResult">): boolean {
  return (
    transaction.status === "FINALIZED" &&
    transaction.executionResult === "FINISHED_WITH_RETURN"
  );
}

export function isTerminalTransactionStatus(status: GenLayerTransactionStatus): boolean {
  return status === "FINALIZED" || status === "CANCELED" || status === "UNDETERMINED";
}

