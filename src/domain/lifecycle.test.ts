import { describe, expect, it } from "vitest";

import { assertMatterTransition, canTransitionMatter, InvalidMatterTransitionError } from "@/domain/lifecycle";

describe("matter lifecycle", () => {
  it("allows the requested-service to accepted transition", () => {
    expect(canTransitionMatter("SERVICE_REQUESTED", "ACCEPTED")).toBe(true);
  });

  it("does not allow a finalized matter to change", () => {
    expect(canTransitionMatter("FINALIZED", "DISPUTED")).toBe(false);
    expect(() => assertMatterTransition("FINALIZED", "DISPUTED")).toThrow(
      InvalidMatterTransitionError,
    );
  });

  it("permits a consensus result to return to review on appeal", () => {
    expect(canTransitionMatter("DECIDED_PENDING_FINALITY", "UNDER_REVIEW")).toBe(true);
  });
});

