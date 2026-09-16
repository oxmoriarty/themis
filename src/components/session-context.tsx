"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { connectStudioNextWallet, type Eip1193Provider } from "@/lib/genlayer/client";

type SessionContextValue = {
  accessToken: string;
  setAccessToken: (value: string) => void;
  walletAddress: string | null;
  walletError: string | null;
  connectWallet: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [accessToken, setAccessToken] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const value = useMemo<SessionContextValue>(() => ({
    accessToken,
    setAccessToken,
    walletAddress,
    walletError,
    connectWallet: async () => {
      setWalletError(null);
      if (!window.ethereum) {
        setWalletError("No EIP-1193 wallet was found. Install or unlock a compatible wallet to connect.");
        return;
      }
      try {
        const connection = await connectStudioNextWallet(window.ethereum);
        setWalletAddress(connection.address);
      } catch (error) {
        setWalletError(error instanceof Error ? error.message : "The wallet could not be connected to Studio Next.");
      }
    },
  }), [accessToken, walletAddress, walletError]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider.");
  return context;
}
