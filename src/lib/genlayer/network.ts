import { studioDevnet } from "genlayer-js/chains";

export const STUDIO_NEXT_CHAIN_ID = 61_997;
export const STUDIO_NEXT_CHAIN_ID_HEX = "0xf22d";
export const STUDIO_NEXT_RPC_URL = "https://studio-next.genlayer.com/api";
export const STUDIO_NEXT_EXPLORER_URL = "https://explorer-studio-dev.genlayer.com/";

export interface StudioNextEnvironment {
  chainId?: string;
  chainName?: string;
  rpcUrl?: string;
  symbol?: string;
}

export class ThemisNetworkError extends Error {
  constructor(
    public readonly code: "INVALID_CONFIGURATION" | "WRONG_NETWORK" | "WALLET_UNAVAILABLE" | "WALLET_REJECTED",
    message: string,
  ) {
    super(message);
    this.name = "ThemisNetworkError";
  }
}

function requiredStudioNextChainId(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return STUDIO_NEXT_CHAIN_ID;
  const parsed = Number(value);
  if (parsed !== STUDIO_NEXT_CHAIN_ID) {
    throw new ThemisNetworkError("INVALID_CONFIGURATION", `Themis only supports Studio Next chain ${STUDIO_NEXT_CHAIN_ID}; received ${value}.`);
  }
  return parsed;
}

/** Keeps the RC v0.6 consensus configuration while selecting Studio Next. */
export function createStudioNextNetwork(environment: StudioNextEnvironment = {}) {
  const id = requiredStudioNextChainId(environment.chainId);
  const rpcUrl = environment.rpcUrl?.trim() || STUDIO_NEXT_RPC_URL;
  if (rpcUrl !== STUDIO_NEXT_RPC_URL) {
    throw new ThemisNetworkError("INVALID_CONFIGURATION", "Studio Next writes require the approved Studio Next RPC endpoint.");
  }

  return {
    ...studioDevnet,
    id,
    name: environment.chainName?.trim() || "GenLayer Studio Next",
    nativeCurrency: {
      name: environment.symbol?.trim() || "GEN",
      symbol: environment.symbol?.trim() || "GEN",
      decimals: 18,
    },
    rpcUrls: { default: { http: [rpcUrl] } },
  } as typeof studioDevnet;
}
