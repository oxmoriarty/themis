import { z } from "zod";

export const matterStateValues = [
  "DRAFT",
  "SERVICE_REQUESTED",
  "ACCEPTED",
  "EVIDENCE_OPEN",
  "IN_PROGRESS",
  "COMPLETION_PENDING",
  "COMPLETED",
  "DISPUTED",
  "UNDER_REVIEW",
  "DECIDED_PENDING_FINALITY",
  "FINALIZED",
  "CANCELLED",
] as const;

export const matterStateSchema = z.enum(matterStateValues);
export type MatterState = z.infer<typeof matterStateSchema>;

export const matterTransitions: Readonly<Record<MatterState, readonly MatterState[]>> = {
  DRAFT: ["SERVICE_REQUESTED", "CANCELLED"],
  SERVICE_REQUESTED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["EVIDENCE_OPEN", "IN_PROGRESS", "CANCELLED"],
  EVIDENCE_OPEN: ["IN_PROGRESS", "DISPUTED", "CANCELLED"],
  IN_PROGRESS: ["EVIDENCE_OPEN", "COMPLETION_PENDING", "DISPUTED", "CANCELLED"],
  COMPLETION_PENDING: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["FINALIZED"],
  DISPUTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["DECIDED_PENDING_FINALITY"],
  DECIDED_PENDING_FINALITY: ["FINALIZED", "UNDER_REVIEW"],
  FINALIZED: [],
  CANCELLED: [],
};

export function canTransitionMatter(from: MatterState, to: MatterState): boolean {
  return matterTransitions[from].includes(to);
}

export class InvalidMatterTransitionError extends Error {
  public constructor(from: MatterState, to: MatterState) {
    super(`Matter cannot transition from ${from} to ${to}.`);
    this.name = "InvalidMatterTransitionError";
  }
}

export function assertMatterTransition(from: MatterState, to: MatterState): void {
  if (!canTransitionMatter(from, to)) {
    throw new InvalidMatterTransitionError(from, to);
  }
}

