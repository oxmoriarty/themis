import { describe, expect, it, vi } from "vitest";

import { connectStudioNextWallet, ThemisClientError, ThemisGenLayerClient, type Eip1193Provider, type GenLayerOperations } from "@/lib/genlayer/client";
import { createStudioNextNetwork, STUDIO_NEXT_CHAIN_ID, STUDIO_NEXT_RPC_URL, ThemisNetworkError } from "@/lib/genlayer/network";

const contractAddress = "0x1111111111111111111111111111111111111111";
const transactionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const currentFeeQuote = { distribution: {}, feeValue: 12n };

function createOperations(overrides: Partial<GenLayerOperations> = {}): GenLayerOperations {
  return {
    readContract: vi.fn().mockResolvedValue("EVIDENCE_OPEN"),
    writeContract: vi.fn().mockResolvedValue(transactionHash),
    waitForDecision: vi.fn(),
    waitForFinalization: vi.fn(),
    ...overrides,
  };
}

describe("Themis GenLayer client", () => {
  it("uses the v0.6 Studio Devnet base only with the required Studio Next endpoint", () => {
    const chain = createStudioNextNetwork();
    expect(chain.id).toBe(STUDIO_NEXT_CHAIN_ID);
    expect(chain.rpcUrls.default.http).toEqual([STUDIO_NEXT_RPC_URL]);
    expect(() => createStudioNextNetwork({ chainId: "61999" })).toThrow(ThemisNetworkError);
  });

  it("uses an unauthenticated read path", async () => {
    const operations = createOperations();
    const client = new ThemisGenLayerClient(operations, contractAddress);

    await expect(client.read({ functionName: "get_matter_state", args: [1n] })).resolves.toBe("EVIDENCE_OPEN");
    expect(operations.readContract).toHaveBeenCalledWith({ address: contractAddress, functionName: "get_matter_state", args: [1n] });
  });

  it("returns a submission hash, not fabricated transaction success", async () => {
    const operations = createOperations();
    const client = new ThemisGenLayerClient(operations, contractAddress);

    await expect(client.submit({ functionName: "open_dispute", args: [4n], fees: currentFeeQuote })).resolves.toMatchObject({ hash: transactionHash, stage: "SUBMITTED" });
    expect(operations.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "open_dispute", value: 0n, fees: currentFeeQuote }));
  });

  it("separates an accepted decision from finalized success", async () => {
    const operations = createOperations({
      waitForDecision: vi.fn().mockResolvedValue({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" }),
      waitForFinalization: vi.fn().mockResolvedValue({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }),
    });
    const client = new ThemisGenLayerClient(operations, contractAddress);

    const accepted = await client.waitForDecision(transactionHash);
    expect(accepted.decisionReached).toBe(true);
    expect(accepted.finalizedSuccessfully).toBe(false);
    expect(() => client.requireFinalizedSuccess(accepted)).toThrow(/appealable/i);

    const finalized = await client.waitForFinalization(transactionHash);
    expect(finalized.finalizedSuccessfully).toBe(true);
    expect(() => client.requireFinalizedSuccess(finalized)).not.toThrow();
  });

  it("blocks post-write consequences when final execution failed", async () => {
    const client = new ThemisGenLayerClient(createOperations({
      waitForFinalization: vi.fn().mockResolvedValue({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }),
    }), contractAddress);

    const finalized = await client.waitForFinalization(transactionHash);
    expect(finalized.finalizedSuccessfully).toBe(false);
    expect(() => client.requireFinalizedSuccess(finalized)).toThrow(ThemisClientError);
  });

  it("rejects unknown lifecycle data rather than promoting it to success", async () => {
    const client = new ThemisGenLayerClient(createOperations({
      waitForDecision: vi.fn().mockResolvedValue({ statusName: "LEADER_REVEALING" }),
    }), contractAddress);

    await expect(client.waitForDecision(transactionHash)).rejects.toMatchObject({ code: "UNKNOWN_TRANSACTION_STATUS" });
  });

  it("requires a Studio Next wallet chain before allowing a writer", async () => {
    const provider: Eip1193Provider = {
      request: vi.fn(async ({ method }) => method === "eth_requestAccounts" ? [contractAddress] : "0xf22f"),
    };

    await expect(connectStudioNextWallet(provider)).rejects.toBeInstanceOf(ThemisNetworkError);
  });
});
