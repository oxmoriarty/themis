import { describe, expect, it } from "vitest";

import {
  consensusEvidenceEntrySchema,
  isEligibleForConsensusPromotion,
  provisionalConsensusEvidenceLimits,
} from "@/domain/evidence";

describe("evidence model", () => {
  it("only allows plain-text files into the future consensus promotion path", () => {
    expect(isEligibleForConsensusPromotion({ mimeType: "text/plain" })).toBe(true);
    expect(isEligibleForConsensusPromotion({ mimeType: "application/pdf" })).toBe(false);
    expect(isEligibleForConsensusPromotion({ mimeType: "image/png" })).toBe(false);
  });

  it("rejects consensus text over the provisional product limit", () => {
    const result = consensusEvidenceEntrySchema.safeParse({
      id: "7e4b109a-07de-4c35-b661-c4773c9eec14",
      matterId: "1f456399-af75-44b1-89d2-9d5d2a8fc98b",
      entryIndex: 0,
      text: "x".repeat(provisionalConsensusEvidenceLimits.maxTextCharactersPerEntry + 1),
      textSha256: "a".repeat(64),
      submittedBy: "0x1111111111111111111111111111111111111111",
      promotionAcknowledgedAt: new Date(),
      onchainTransactionHash: null,
    });

    expect(result.success).toBe(false);
  });
});

