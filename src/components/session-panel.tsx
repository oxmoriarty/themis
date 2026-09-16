"use client";

import { KeyRound, Wallet } from "lucide-react";

import { useSession } from "@/components/session-context";

export function SessionPanel() {
  const { accessToken, setAccessToken, connectWallet, walletAddress, walletError } = useSession();
  return (
    <aside className="auth-panel" aria-label="Authenticated workspace connection">
      <KeyRound size={18} aria-hidden="true" />
      <strong>Authenticated workspace</strong>
      <p>Paste a short-lived Supabase session token to use private matter and developer actions. It stays only in this browser tab.</p>
      <label className="field"><span className="sr-only">Supabase access token</span><input className="input" type="password" autoComplete="off" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="Short-lived access token" /></label>
      <button type="button" className="button button--paper" onClick={() => void connectWallet()}><Wallet size={15} aria-hidden="true" /> {walletAddress ? "Wallet checked" : "Check Studio Next wallet"}</button>
      {walletError && <span className="auth-status">{walletError}</span>}
      {accessToken && <span className="auth-status">Session token is ready for authenticated API calls.</span>}
    </aside>
  );
}
