import { describe, expect, it } from "vitest";

import { stageConsensusEvidenceSchema } from "@/server/api-schemas";

describe("public evidence staging validation", () => {
  const idempotencyKey = "22222222-2222-4222-8222-222222222222";

  it("requires an explicit acknowledgement before any public-text staging", () => {
    expect(() => stageConsensusEvidenceSchema.parse({
      publicText: "The delivery acknowledgement says the work was received.",
      promotionAcknowledged: false,
      idempotencyKey,
    })).toThrow();
  });

  it("rejects unbounded public-text submissions", () => {
    expect(() => stageConsensusEvidenceSchema.parse({
      publicText: "a".repeat(12_001),
      promotionAcknowledged: true,
      idempotencyKey,
    })).toThrow();
  });
});
