import { describe, expect, it } from "vitest";

import {
  genLayerTransactionStatusSchema,
  hasSuccessfulExecution,
  isTerminalTransactionStatus,
} from "@/domain/chain";

describe("GenLayer transaction model", () => {
  it("accepts only the supplied SDK status values", () => {
    expect(genLayerTransactionStatusSchema.safeParse("FINALIZED").success).toBe(true);
    expect(genLayerTransactionStatusSchema.safeParse("LEADER_REVEALING").success).toBe(false);
    expect(genLayerTransactionStatusSchema.safeParse("OUT_OF_FEE").success).toBe(false);
  });

  it("requires both finality and a successful execution result", () => {
    expect(
      hasSuccessfulExecution({
        status: "FINALIZED",
        executionResult: "FINISHED_WITH_RETURN",
      }),
    ).toBe(true);
    expect(
      hasSuccessfulExecution({
        status: "ACCEPTED",
        executionResult: "FINISHED_WITH_RETURN",
      }),
    ).toBe(false);
    expect(
      hasSuccessfulExecution({
        status: "FINALIZED",
        executionResult: "FINISHED_WITH_ERROR",
      }),
    ).toBe(false);
  });

  it("treats undetermined as terminal but not successful", () => {
    expect(isTerminalTransactionStatus("UNDETERMINED")).toBe(true);
  });
});

